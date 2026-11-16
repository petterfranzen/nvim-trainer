import { Engine } from './engine.ts';
import { InputBuffer } from './input.ts';
import { LEVELS } from './levels.ts';
import { renderGrid } from './render.ts';
import { commandInfo, ALL_COMMANDS, ABILITY_NAMES, ABILITY_SHORT_NAMES } from './commands.ts';
import { getProgress, markCompleted } from './storage.ts';
import { fuzzyMatch } from './fuzzy.ts';
import type { AbilityId, CommandId } from './types.ts';

type StepResult = ReturnType<Engine['step']>;

/** The engine call each command key is wired to (`ff` opens the finder instead). */
const ENGINE_ACTIONS: Partial<Record<CommandId, (engine: Engine) => StepResult>> = {
  h: (e) => e.step(-1, 0),
  j: (e) => e.step(0, 1),
  k: (e) => e.step(0, -1),
  l: (e) => e.step(1, 0),
  w: (e) => e.wordForward(),
  b: (e) => e.wordBack(),
  e: (e) => e.wordEnd(),
  '0': (e) => e.lineStart(),
  $: (e) => e.lineEnd(),
  gg: (e) => e.top(),
  G: (e) => e.bottom(),
  dd: (e) => e.destroy(),
  yy: (e) => e.yank(),
  p: (e) => e.put(),
};

/** Commands a count prefix repeats; every other command runs once. */
const REPEATABLE = new Set<CommandId>(['h', 'j', 'k', 'l', 'w', 'b', 'e']);
const MAX_REPEATS = 50;
/** Results that end a counted repeat early. */
const STOPS_REPEAT = new Set<StepResult['kind']>(['zapped', 'won', 'blocked']);

/** Message shown after a command, by result kind; anything else clears it. */
const RESULT_MESSAGES: Partial<Record<StepResult['kind'], string>> = {
  zapped: 'Zapped! Back to the start - try a jump motion instead.',
  cleared: 'Rubble cleared!',
  'picked-up': 'Picked up the key.',
  placed: 'Door opened!',
  'secret-found': 'Secret found!',
};

const OVERLAY_ADVANCE_KEYS = new Set(['Enter', ' ']);

function hasModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}

export class GameController {
  private engine!: Engine;
  private input = new InputBuffer();
  private levelIndex = 0;
  private unlocked = new Set<CommandId>();
  private unlockedAbilities = new Set<AbilityId>();

  private root: HTMLElement;
  private grid: HTMLElement;
  private hud: HTMLElement;
  private message: HTMLElement;
  private overlay: HTMLElement;
  private finder: HTMLElement;
  private keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);

  // <space>ff's live search state - see enterSearchMode/renderFinder.
  // While searchMode is true, onKeyDown routes raw keys here instead of
  // through InputBuffer, the same way the level-complete overlay already
  // takes over keydown handling below.
  private searchMode = false;
  private fuzzyQuery = '';
  private fuzzySelected = 0;
  // "x,y" -> icon, rebuilt once per level start (see start()) rather than
  // on every render - it only ever changes when the level itself does.
  private fileIcons = new Map<string, string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div id="hud"></div>
      <div id="grid" class="grid"></div>
      <div id="message" class="message"></div>
      <div id="overlay" class="overlay hidden"></div>
      <div id="finder" class="finder hidden"></div>
    `;
    this.hud = this.root.querySelector('#hud')!;
    this.grid = this.root.querySelector('#grid')!;
    this.message = this.root.querySelector('#message')!;
    this.overlay = this.root.querySelector('#overlay')!;
    this.finder = this.root.querySelector('#finder')!;
    document.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
  }

  start(levelIndex: number) {
    this.levelIndex = levelIndex;
    this.recomputeUnlocked();
    this.engine = new Engine(LEVELS[levelIndex], this.unlockedAbilities);
    this.fileIcons = new Map((LEVELS[levelIndex].files ?? []).map((f) => [`${f.pos.x},${f.pos.y}`, f.icon]));
    this.overlay.classList.add('hidden');
    this.exitSearchMode(false);
    this.setMessage('');
    this.renderAll();
  }

  /**
   * Commands and abilities both persist once unlocked, regardless of
   * which level is currently loaded - critical for backtracking (see the
   * level-select screen in main.ts): replaying an early level must not
   * "forget" a command or ability actually earned from a level reached
   * since. The ceiling is the higher of "the level currently open" and
   * "the furthest level this save has ever reached" (persisted
   * separately in storage.ts), not just this.levelIndex on its own.
   */
  private recomputeUnlocked() {
    const ceiling = Math.max(this.levelIndex, getProgress().highestUnlocked);
    this.unlocked = new Set();
    this.unlockedAbilities = new Set();
    for (let i = 0; i <= ceiling && i < LEVELS.length; i++) {
      for (const c of LEVELS[i].unlocks) this.unlocked.add(c);
      const ability = LEVELS[i].grantsAbility;
      if (ability) this.unlockedAbilities.add(ability);
    }
    // The count-prefix trick is revealed as a bonus tip on reaching the
    // final level, and (like everything else here) stays revealed once
    // reached even when replaying an earlier one afterward.
    if (ceiling >= LEVELS.length - 1) this.unlocked.add('count');
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.overlay.classList.contains('hidden')) {
      this.handleOverlayKey(e);
      return;
    }
    if (this.searchMode) {
      e.preventDefault();
      this.handleSearchKey(e.key);
      return;
    }
    if (hasModifier(e)) return;
    this.handleGameKey(e);
  }

  private handleOverlayKey(e: KeyboardEvent) {
    if (!OVERLAY_ADVANCE_KEYS.has(e.key)) return;
    e.preventDefault();
    this.advanceAfterOverlay();
  }

  private handleGameKey(e: KeyboardEvent) {
    // Space has no other role in this game (never a motion, never text) -
    // suppress the browser's default page-scroll for it unconditionally,
    // rather than only once a full <space>ff sequence completes. The
    // completed-command preventDefault() further down only fires once
    // InputBuffer returns a non-null result, which the leading space of
    // that sequence never does on its own (it just starts buffering).
    if (e.key === ' ') e.preventDefault();
    const parsed = this.input.handleKey(e.key);
    this.renderHud(); // reflect any pending chord/count buffer
    if (!parsed) return;

    if (!this.isUsable(parsed.id)) {
      this.setMessage(`"${parsed.id}" isn't unlocked yet.`);
      return;
    }
    e.preventDefault();
    this.dispatch(parsed.id, parsed.count);
  }

  /** The count prefix is always accepted; everything else must be unlocked. */
  private isUsable(id: CommandId): boolean {
    return id === 'count' || this.unlocked.has(id);
  }

  private dispatch(id: CommandId, count: number) {
    if (id === 'ff') {
      this.enterSearchMode();
      return;
    }
    const last = this.runCommand(id, count);
    this.renderAll();
    if (last.kind === 'won') {
      this.onLevelComplete();
      return;
    }
    this.setMessage(RESULT_MESSAGES[last.kind] ?? '');
  }

  /** Runs a command (repeated for a count where that applies) and returns the last result. */
  private runCommand(id: CommandId, count: number): StepResult {
    let last: StepResult = { kind: 'noop' };
    const run = ENGINE_ACTIONS[id];
    if (!run) return last;
    const times = REPEATABLE.has(id) ? Math.max(1, Math.min(count, MAX_REPEATS)) : 1;
    for (let i = 0; i < times; i++) {
      last = run(this.engine);
      if (STOPS_REPEAT.has(last.kind)) break;
    }
    return last;
  }

  private enterSearchMode() {
    if ((LEVELS[this.levelIndex].files ?? []).length === 0) return;
    this.searchMode = true;
    this.fuzzyQuery = '';
    this.fuzzySelected = 0;
    this.finder.classList.remove('hidden');
    this.renderFinder();
  }

  private exitSearchMode(warp: boolean) {
    if (warp && this.searchMode) this.warpToSelection();
    this.searchMode = false;
    this.fuzzyQuery = '';
    this.fuzzySelected = 0;
    this.finder.classList.add('hidden');
    this.finder.innerHTML = '';
  }

  private warpToSelection() {
    const matches = fuzzyMatch(this.fuzzyQuery, LEVELS[this.levelIndex].files ?? []);
    const target = matches[this.fuzzySelected];
    if (!target) return;
    const result = this.engine.warp(target.pos);
    this.renderAll();
    if (result.kind === 'won') this.onLevelComplete();
    else if (result.kind === 'secret-found') this.setMessage('Secret found!');
  }

  private searchKeys = new Map<string, () => void>([
    ['Escape', () => this.exitSearchMode(false)],
    ['Enter', () => this.exitSearchMode(true)],
    ['Backspace', () => this.setQuery(this.fuzzyQuery.slice(0, -1))],
    ['ArrowDown', () => this.moveSelection(1)],
    ['ArrowUp', () => this.moveSelection(-1)],
  ]);

  private handleSearchKey(key: string) {
    const handler = this.searchKeys.get(key);
    if (handler) {
      handler();
      return;
    }
    // A single printable character (letters/digits/punctuation/space) -
    // e.key is the full name ("Shift", "Tab", ...) for anything else, so
    // length === 1 is a reliable enough filter without an allowlist.
    if (key.length === 1) this.setQuery(this.fuzzyQuery + key);
  }

  private setQuery(query: string) {
    this.fuzzyQuery = query;
    this.fuzzySelected = 0;
    this.renderFinder();
  }

  /** Moves the finder selection by `delta`, wrapping around the match list. */
  private moveSelection(delta: number) {
    const count = fuzzyMatch(this.fuzzyQuery, LEVELS[this.levelIndex].files ?? []).length;
    if (count > 0) this.fuzzySelected = (this.fuzzySelected + delta + count) % count;
    this.renderFinder();
  }

  private renderFinder() {
    const files = LEVELS[this.levelIndex].files ?? [];
    const matches = fuzzyMatch(this.fuzzyQuery, files);
    const rows = matches
      .map(
        (m, i) => `<div class="finder-item${i === this.fuzzySelected ? ' selected' : ''}"><span class="finder-item-icon">${m.icon}</span>${m.name}</div>`,
      )
      .join('');
    this.finder.innerHTML = `
      <div class="finder-box">
        <div class="finder-title">Find Files</div>
        <div class="finder-query">&gt; ${this.fuzzyQuery}<span class="finder-cursor">_</span></div>
        <div class="finder-list">${rows || '<div class="finder-empty">no matches</div>'}</div>
        <div class="finder-hint">Enter to jump &middot; Esc to cancel &middot; &uarr;&darr; to change selection</div>
      </div>
    `;
  }

  private onLevelComplete() {
    // Checked before markCompleted mutates storage - a level revisited
    // via the level-select screen (see main.ts) after already being
    // beaten shouldn't claim to freshly "unlock" a command/ability it's
    // had all along.
    const firstTime = !getProgress().completed.includes(this.levelIndex);
    markCompleted(this.levelIndex, LEVELS.length);
    const isLast = this.levelIndex === LEVELS.length - 1;
    const level = LEVELS[this.levelIndex];

    let unlockLine = 'Nice work.';
    if (firstTime) {
      const grants: string[] = level.unlocks.map((c) => commandInfo(c).keys);
      if (level.grantsAbility) grants.push(ABILITY_NAMES[level.grantsAbility]);
      if (grants.length) unlockLine = 'New: ' + grants.join(', ');
    } else if (isLast) {
      unlockLine = 'Already beaten - revisited.';
    }

    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = isLast
      ? `<div class="overlay-box">
          <h2>You've completed Vim Quest!</h2>
          <p>Every level beaten with real Vim motions. Nice work.</p>
          <p class="overlay-hint">Press Enter to return to the title screen.</p>
        </div>`
      : `<div class="overlay-box">
          <h2>Level Complete: ${level.title}</h2>
          <p>${unlockLine}</p>
          <p class="overlay-hint">Press Enter to continue.</p>
        </div>`;
    this.pendingAdvance = isLast ? 'title' : 'next';
  }

  private pendingAdvance: 'next' | 'title' | null = null;
  private advanceAfterOverlay() {
    if (this.pendingAdvance === 'next') {
      this.start(this.levelIndex + 1);
    } else if (this.pendingAdvance === 'title') {
      this.onGameComplete?.();
    }
    this.pendingAdvance = null;
  }

  /** Set by the app shell to return to the title screen after finishing the game. */
  onGameComplete: (() => void) | null = null;

  private setMessage(text: string) {
    this.message.textContent = text;
  }

  private renderAll() {
    renderGrid(this.grid, this.engine.state, this.fileIcons);
    this.renderHud();
  }

  private renderHud() {
    const level = LEVELS[this.levelIndex];
    const legend = ALL_COMMANDS.filter((c) => this.unlocked.has(c.id))
      .map((c) => `<span class="legend-item"><kbd>${c.keys}</kbd><span class="legend-desc">${c.description}</span></span>`)
      .join('');
    const buffer = this.input.displayBuffer;
    const abilityBadges = [...this.unlockedAbilities]
      .map((a) => `<span class="badge badge-ability">${ABILITY_SHORT_NAMES[a]}</span>`)
      .join('');
    this.hud.innerHTML = `
      <div class="hud-top">
        <span class="level-name">Level ${this.levelIndex + 1}/${LEVELS.length}: ${level.title}</span>
        <span class="hud-right">
          ${abilityBadges}
          ${this.engine.state.hasItem ? '<span class="badge">holding key</span>' : ''}
          <span class="moves">moves: ${this.engine.state.moves}</span>
          <span class="buffer">${buffer ? `[${buffer}]` : ''}</span>
        </span>
      </div>
      <div class="hint">${level.hint}</div>
      <div class="legend">${legend}</div>
    `;
  }
}

export function getInitialLevel(): number {
  return getProgress().highestUnlocked;
}

export const TOTAL_LEVELS = LEVELS.length;

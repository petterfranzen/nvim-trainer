import { Engine } from './engine.ts';
import { InputBuffer } from './input.ts';
import { LEVELS } from './levels.ts';
import { renderGrid } from './render.ts';
import { commandInfo, ALL_COMMANDS } from './commands.ts';
import { getProgress, markCompleted } from './storage.ts';
import type { CommandId } from './types.ts';

export class GameController {
  private engine!: Engine;
  private input = new InputBuffer();
  private levelIndex = 0;
  private unlocked = new Set<CommandId>();

  private root: HTMLElement;
  private grid: HTMLElement;
  private hud: HTMLElement;
  private message: HTMLElement;
  private overlay: HTMLElement;
  private keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div id="hud"></div>
      <div id="grid" class="grid"></div>
      <div id="message" class="message"></div>
      <div id="overlay" class="overlay hidden"></div>
    `;
    this.hud = this.root.querySelector('#hud')!;
    this.grid = this.root.querySelector('#grid')!;
    this.message = this.root.querySelector('#message')!;
    this.overlay = this.root.querySelector('#overlay')!;
    document.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
  }

  start(levelIndex: number) {
    this.levelIndex = levelIndex;
    this.recomputeUnlocked();
    this.engine = new Engine(LEVELS[levelIndex]);
    this.overlay.classList.add('hidden');
    this.setMessage('');
    this.renderAll();
  }

  private recomputeUnlocked() {
    this.unlocked = new Set();
    for (let i = 0; i <= this.levelIndex; i++) {
      for (const c of LEVELS[i].unlocks) this.unlocked.add(c);
    }
    // The count-prefix trick is revealed as a bonus tip on the final level.
    if (this.levelIndex === LEVELS.length - 1) this.unlocked.add('count');
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.overlay.classList.contains('hidden')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.advanceAfterOverlay();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const parsed = this.input.handleKey(e.key);
    this.renderHud(); // reflect any pending chord/count buffer
    if (!parsed) return;

    if (!this.unlocked.has(parsed.id) && parsed.id !== 'count') {
      this.setMessage(`"${parsed.id}" isn't unlocked yet.`);
      return;
    }
    e.preventDefault();
    this.dispatch(parsed.id, parsed.count);
  }

  private dispatch(id: CommandId, count: number) {
    const reps = Math.max(1, Math.min(count, 50));
    let last: ReturnType<Engine['step']> = { kind: 'noop' };

    const runOnce = (): ReturnType<Engine['step']> => {
      switch (id) {
        case 'h': return this.engine.step(-1, 0);
        case 'j': return this.engine.step(0, 1);
        case 'k': return this.engine.step(0, -1);
        case 'l': return this.engine.step(1, 0);
        case 'w': return this.engine.wordForward();
        case 'b': return this.engine.wordBack();
        case 'e': return this.engine.wordEnd();
        case '0': return this.engine.lineStart();
        case '$': return this.engine.lineEnd();
        case 'gg': return this.engine.top();
        case 'G': return this.engine.bottom();
        case 'dd': return this.engine.destroy();
        case 'yy': return this.engine.yank();
        case 'p': return this.engine.put();
        default: return { kind: 'noop' };
      }
    };

    const repeatable = id === 'h' || id === 'j' || id === 'k' || id === 'l' || id === 'w' || id === 'b' || id === 'e';
    const times = repeatable ? reps : 1;
    for (let i = 0; i < times; i++) {
      last = runOnce();
      if (last.kind === 'zapped' || last.kind === 'won' || last.kind === 'blocked') break;
    }

    this.renderAll();

    switch (last.kind) {
      case 'zapped':
        this.setMessage('Zapped! Back to the start - try a jump motion instead.');
        break;
      case 'won':
        this.onLevelComplete();
        break;
      case 'cleared':
        this.setMessage('Rubble cleared!');
        break;
      case 'picked-up':
        this.setMessage('Picked up the key.');
        break;
      case 'placed':
        this.setMessage('Door opened!');
        break;
      case 'blocked':
        this.setMessage('');
        break;
      default:
        this.setMessage('');
    }
  }

  private onLevelComplete() {
    markCompleted(this.levelIndex, LEVELS.length);
    const isLast = this.levelIndex === LEVELS.length - 1;
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = isLast
      ? `<div class="overlay-box">
          <h2>You've completed Vim Quest!</h2>
          <p>Every level beaten with real Vim motions. Nice work.</p>
          <p class="overlay-hint">Press Enter to return to the title screen.</p>
        </div>`
      : `<div class="overlay-box">
          <h2>Level Complete: ${LEVELS[this.levelIndex].title}</h2>
          <p>${LEVELS[this.levelIndex].unlocks.length ? 'New commands unlocked: ' + LEVELS[this.levelIndex].unlocks.map((c) => commandInfo(c).keys).join(', ') : 'Nice work.'}</p>
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
    renderGrid(this.grid, this.engine.state);
    this.renderHud();
  }

  private renderHud() {
    const level = LEVELS[this.levelIndex];
    const legend = ALL_COMMANDS.filter((c) => this.unlocked.has(c.id))
      .map((c) => `<span class="legend-item"><kbd>${c.keys}</kbd><span class="legend-desc">${c.description}</span></span>`)
      .join('');
    const buffer = this.input.displayBuffer;
    this.hud.innerHTML = `
      <div class="hud-top">
        <span class="level-name">Level ${this.levelIndex + 1}/${LEVELS.length}: ${level.title}</span>
        <span class="hud-right">
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

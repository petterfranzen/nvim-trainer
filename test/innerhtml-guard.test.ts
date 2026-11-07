import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { renderGrid } from '../src/game/render.ts';
import { GameController } from '../src/game/controller.ts';
import type { LevelState, Tile } from '../src/game/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/** An element stub with just the surface renderGrid / GameController touch. */
function el() {
  return {
    innerHTML: '',
    textContent: '',
    classList: { add() {}, remove() {}, contains: () => false },
    style: { setProperty() {} },
    querySelector: (sel: string) => getEl(sel),
  };
}
const registry = new Map<string, ReturnType<typeof el>>();
function getEl(sel: string) {
  if (!registry.has(sel)) registry.set(sel, el());
  return registry.get(sel)!;
}

function fakeContainer() {
  return { innerHTML: '', style: { setProperty() {} } } as unknown as HTMLElement;
}

function stubDom() {
  registry.clear();
  const root = el();
  const store = new Map<string, string>();
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return root;
}

afterEach(() => vi.unstubAllGlobals());

describe('renderGrid escapes interpolated cells', () => {
  it('escapes a file icon (level data) instead of injecting it', () => {
    const container = fakeContainer();
    const state: LevelState = {
      grid: [['F', '.']] as Tile[][],
      player: { x: 1, y: 0 },
      start: { x: 1, y: 0 },
      hasItem: false,
      moves: 0,
      won: false,
    };
    renderGrid(container, state, new Map([['0,0', '<img src=x onerror=alert(1)>']]));
    expect(container.innerHTML).toContain('&lt;img');
    expect(container.innerHTML).not.toContain('<img');
  });

  it('escapes a tile character that is not in the known vocabulary', () => {
    const container = fakeContainer();
    const state: LevelState = {
      grid: [['<']] as unknown as Tile[][],
      player: { x: 0, y: 5 },
      start: { x: 0, y: 5 },
      hasItem: false,
      moves: 0,
      won: false,
    };
    renderGrid(container, state);
    expect(container.innerHTML).toContain('&lt;');
    expect(container.innerHTML).not.toContain('floor"><');
  });
});

describe('GameController escapes everything it interpolates into innerHTML', () => {
  // Level index 8 ("Find Files") is the first level with a files[] list, so
  // its finder is the real, live-in-the-app path a user's keystrokes reach.
  it('escapes the fuzzy-finder query, the one genuinely user-typed input', () => {
    const root = stubDom();
    const controller = new GameController(root as unknown as HTMLElement);
    controller.start(8);
    (controller as unknown as { enterSearchMode(): void }).enterSearchMode();
    for (const ch of '<img src=x onerror=alert(1)>') {
      (controller as unknown as { handleSearchKey(k: string): void }).handleSearchKey(ch);
    }
    const html = getEl('#finder').innerHTML;
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('escapes level titles and hints in the HUD, so <space> renders as text not a parsed element', () => {
    const root = stubDom();
    const controller = new GameController(root as unknown as HTMLElement);
    controller.start(8);
    const html = getEl('#hud').innerHTML;
    expect(html).toContain('&lt;space&gt;ff'); // the ff legend key, escaped
    expect(html).not.toContain('<space>'); // never left raw for the parser to eat
  });
});

describe('source guard: no unescaped data interpolation into innerHTML', () => {
  // Identifiers that carry level- or user-controlled data. If a future edit
  // interpolates one of these into a template without escapeHtml(), this
  // fails rather than silently reopening the hole the helper was added for.
  const DATA = [
    'fuzzyQuery',
    'm.name',
    'm.icon',
    'c.keys',
    'c.description',
    'level.title',
    'level.hint',
    'buffer',
    'unlockLine',
    'char',
    'cls',
    'ABILITY_SHORT_NAMES',
    'LEVELS[i].title',
  ];
  const FILES = ['src/game/render.ts', 'src/game/controller.ts', 'src/main.ts'];

  for (const rel of FILES) {
    it(`${rel}: every data interpolation is wrapped in escapeHtml()`, () => {
      const src = readFileSync(resolve(repoRoot, rel), 'utf8');
      const exprs = [...src.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
      const offenders = exprs.filter(
        (e) => DATA.some((d) => e.includes(d)) && !e.includes('escapeHtml('),
      );
      expect(offenders).toEqual([]);
    });
  }

  it('every file that assigns innerHTML imports the escaping helper', () => {
    for (const rel of FILES) {
      const src = readFileSync(resolve(repoRoot, rel), 'utf8');
      if (src.includes('innerHTML')) expect(src).toContain('escape.ts');
    }
  });
});

import { describe, it, expect } from 'vitest';
import { fuzzyMatch, type FileEntry } from '../src/game/fuzzy.ts';

const files: FileEntry[] = [
  { name: 'config.ts', pos: { x: 0, y: 0 }, icon: '\u2699\ufe0f' },
  { name: 'index.ts', pos: { x: 1, y: 0 }, icon: '\u2b50' },
  { name: 'main.ts', pos: { x: 2, y: 0 }, icon: '\ud83d\udcc4' },
  { name: 'utils.ts', pos: { x: 3, y: 0 }, icon: '\ud83d\udd27' },
];

const names = (q: string) => fuzzyMatch(q, files).map((m) => m.name);

describe('fuzzyMatch', () => {
  it('returns every candidate, unscored, in level-definition order for an empty query', () => {
    const out = fuzzyMatch('', files);
    expect(out.map((m) => m.name)).toEqual(['config.ts', 'index.ts', 'main.ts', 'utils.ts']);
    expect(out.every((m) => m.score === 0)).toBe(true);
  });

  it('returns nothing when no candidate contains the query as a subsequence', () => {
    expect(names('zzz')).toEqual([]);
    expect(names('tx')).toEqual([]);
  });

  it('requires the query characters in order, not contiguously', () => {
    // "ci" is c...i across config.ts, but there is no "ic" anywhere
    expect(names('ci')).toEqual(['config.ts']);
    expect(names('ic')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    expect(names('MAIN')).toEqual(['main.ts']);
    expect(names('InDeX')).toEqual(['index.ts']);
  });

  it('orders by score - an earlier, tighter span beats a later or scattered one', () => {
    // i at 0 in index, 2 in main/utils, 4 in config; span 1 everywhere
    expect(names('i')).toEqual(['index.ts', 'main.ts', 'utils.ts', 'config.ts']);
  });

  it('breaks ties by name so the order is stable', () => {
    // main.ts and utils.ts both score 1 + 2*0.1 = 1.2 for "i"
    const out = fuzzyMatch('i', files).filter((m) => m.score === 1.2).map((m) => m.name);
    expect(out).toEqual(['main.ts', 'utils.ts']);
  });

  it('carries the matched entry through unchanged apart from the score', () => {
    const [hit] = fuzzyMatch('main', files);
    expect(hit).toMatchObject({ name: 'main.ts', pos: { x: 2, y: 0 }, icon: '\ud83d\udcc4' });
    expect(typeof hit.score).toBe('number');
  });
});

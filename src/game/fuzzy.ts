import type { Point } from './types.ts';

export interface FileEntry {
  name: string;
  pos: Point;
  icon: string;
}

export interface FuzzyMatch extends FileEntry {
  /** Lower is a better match. */
  score: number;
}

/**
 * Subsequence fuzzy match, the same basic idea Telescope/fzf use: every
 * character of `query`, lowercased, must appear in `name` in order, but
 * not necessarily contiguously ("ff" matches "config.ts" as f...f... - a
 * real fuzzy finder would too). Score rewards a tighter, earlier span so
 * a compact match like "main" beats a scattered one for the same query.
 * An empty query matches everything, unscored, in level-definition order
 * - exactly what you'd see opening the finder before typing anything.
 */
export function fuzzyMatch(query: string, candidates: FileEntry[]): FuzzyMatch[] {
  const q = query.toLowerCase();
  if (q === '') return candidates.map((c) => ({ ...c, score: 0 }));

  const results: FuzzyMatch[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    let qi = 0;
    let firstIndex = -1;
    let lastIndex = -1;
    for (let ni = 0; ni < name.length && qi < q.length; ni++) {
      if (name[ni] === q[qi]) {
        if (firstIndex === -1) firstIndex = ni;
        lastIndex = ni;
        qi++;
      }
    }
    if (qi < q.length) continue; // not every query char found in order
    const span = lastIndex - firstIndex + 1;
    results.push({ ...candidate, score: span + firstIndex * 0.1 });
  }
  results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return results;
}

import type { LevelDef } from './types.ts';

// Design notes on the shared mechanic used across several levels:
//
// Hazard tiles ('X') zap the player back to the level's start if stepped
// onto one tile at a time via h/j/k/l. "Jump" motions - 0 $ gg G w b e -
// move directly to a destination without occupying the tiles in between,
// so they sail over hazards safely. This mirrors real Vim: hjkl walk the
// cursor one cell at a time, while 0/$/gg/G/w/b/e are absolute or
// word-relative jumps that don't "pass through" every intervening cell.
//
// Pit tiles ('~') are simply impassable to step motions; word motions
// (w/b/e) can leap over them because word boundaries are computed
// independently of the tiles physically in between - just like Vim skips
// over punctuation/whitespace when hopping between words.

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    title: 'First Steps',
    unlocks: ['h', 'j', 'k', 'l'],
    hint: 'Use h (left) j (down) k (up) l (right) to snake your way to the goal G.',
    grid: [
      '###########',
      '#@........#',
      '#########.#',
      '#.........#',
      '#.#########',
      '#.........#',
      '#########.#',
      '#........G#',
      '###########',
    ],
  },
  {
    id: 2,
    title: 'Line Endings',
    unlocks: ['0', '$'],
    hint: 'Hazard tiles (X) zap you if you walk into them. Press 0 to jump to the start of the row, or $ to jump to its end - jumps sail clean over hazards.',
    grid: [
      '###########',
      '#@.XXXXX..#',
      '#########.#',
      '#..XXXXX..#',
      '#.#########',
      '#..XXXXX..#',
      '#########.#',
      '#G.XXXXX..#',
      '###########',
    ],
  },
  {
    id: 3,
    title: 'Word Hops',
    unlocks: ['w', 'b', 'e'],
    hint: 'Pits (~) block h/j/k/l. Press w to jump to the start of the next word, b for the previous word, e for the end of a word - words leap clean over pits.',
    grid: [
      '###################',
      '#@..~~...~~...~~.G#',
      '###################',
    ],
  },
  {
    id: 4,
    title: 'Top and Bottom',
    unlocks: ['gg', 'G'],
    hint: 'Press G to drop straight to the bottom of a shaft, or gg to jump straight to the top - both sail past the hazards in between.',
    grid: [
      '#########',
      '##@###G##',
      '##X###X##',
      '##X###X##',
      '##X###X##',
      '##X###X##',
      '##X###X##',
      '##X###X##',
      '##.....##',
      '#########',
    ],
  },
  {
    id: 5,
    title: 'Clear the Rubble',
    unlocks: ['dd'],
    hint: 'The goal is buried under rubble (O). Stand on it and press dd (twice) to clear it and win.',
    grid: [
      '###########',
      '#@........#',
      '#########.#',
      '#.........#',
      '#.#########',
      '#.........#',
      '#########.#',
      '#........O#',
      '###########',
    ],
  },
  {
    id: 6,
    title: 'Fetch and Place',
    unlocks: ['yy', 'p'],
    hint: 'Stand on the key (K) and press yy (twice) to pick it up. Walk next to the door (D) and press p to place the key and open it.',
    grid: [
      '###########',
      '#@..K.....#',
      '#########D#',
      '#........G#',
      '###########',
    ],
  },
  {
    id: 7,
    title: 'Combined Trial',
    unlocks: [],
    hint: 'Everything so far: hop the pits with w/e, jump the hazard row with 0, then clear the rubble with dd.',
    grid: [
      '###########',
      '#@~~.~~...#',
      '#########.#',
      '#..XXXXX..#',
      '#.#########',
      '#........O#',
      '###########',
    ],
  },
  {
    id: 8,
    title: 'Final Gauntlet',
    unlocks: [],
    hint: 'Drop the shaft with G, fetch the key with yy, and place it with p to open the final door. Tip: a number before a motion repeats it, e.g. 3l moves right three tiles at once.',
    grid: [
      '#########',
      '####@####',
      '####X####',
      '####X####',
      '#.......#',
      '#.K.....#',
      '####D####',
      '####G####',
      '#########',
    ],
  },
];

// Core tile vocabulary for the ASCII world.
//
// '#'  wall        impassable to every motion
// '.'  floor       normal walkable ground
// 'G'  goal        reach it (uncovered) to win the level
// 'X'  hazard      zaps you back to the level start if you STEP onto it
//                  one tile at a time (h/j/k/l). Jump-style motions
//                  (0 $ gg G w b e) land past it safely because they move
//                  directly to a destination without occupying the tiles
//                  in between - just like real Vim, which doesn't "walk"
//                  the cursor through every intervening column/line.
// '~'  pit         impassable to step motions (h/j/k/l); word motions
//                  (w/b/e) can jump clear over it to the next/previous word.
// 'O'  rubble      walkable, but covers something (usually the goal).
//                  Standing on it and pressing dd clears it.
// 'K'  key/item    walkable. Standing on it and pressing yy picks it up.
// 'D'  door        impassable until you place a held item next to it (p).
// '@'  player      start position marker (parsed out, not rendered as a tile)
export type Tile = '#' | '.' | 'G' | 'X' | '~' | 'O' | 'K' | 'D' | '@';

export type CommandId =
  | 'h' | 'j' | 'k' | 'l'
  | 'w' | 'b' | 'e'
  | '0' | '$'
  | 'gg' | 'G'
  | 'dd'
  | 'yy' | 'p'
  | 'count';

export interface CommandInfo {
  id: CommandId;
  keys: string;
  description: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelDef {
  id: number;
  title: string;
  /** Command families newly unlocked on this level (shown in the HUD legend). */
  unlocks: CommandId[];
  /** Short in-level tutorial hint shown at the top of the level. */
  hint: string;
  /** Row strings. All rows must be the same length. */
  grid: string[];
}

export interface LevelState {
  grid: Tile[][];
  player: Point;
  start: Point;
  hasItem: boolean;
  moves: number;
  won: boolean;
}

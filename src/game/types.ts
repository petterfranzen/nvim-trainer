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
// 'F'  file        walkable, purely a landing marker for <space>ff's warp -
//                  named separately in LevelDef.files since a single ASCII
//                  cell can't hold a whole filename. Rendered as its own
//                  entry's icon (see LevelDef.files), not a literal 'F' -
//                  the same icon then reappears next to its name in the
//                  finder list, so a decoy seen out in the open is
//                  recognizable at a glance once you're staring at the
//                  full list, the way a real fuzzy-finder's file-type
//                  icons let you scan visually instead of reading every
//                  line.
// 'C'  chasm       impassable to everything, same as a wall - *until* the
//                  Far Jump ability is granted, at which point it behaves
//                  exactly like a pit ('~'): still blocks h/j/k/l, but
//                  every jump motion (0 $ gg G w b e) crosses it freely.
//                  The ability upgrades what your existing motions reach,
//                  not a new keybinding.
// 'P'  phase wall  impassable to everything, same as a wall - *until* the
//                  Phase ability is granted, at which point it behaves
//                  exactly like floor for every motion, h/j/k/l included.
//                  Rendered distinctly from '#' so a level can telegraph
//                  "you'll be able to get through here later."
// '!'  secret      walkable; reaching it once shows a one-off message and
//                  turns into floor. Purely a reward for exploring/
//                  backtracking - never required to reach the goal.
// '@'  player      start position marker (parsed out, not rendered as a tile)
export type Tile = '#' | '.' | 'G' | 'X' | '~' | 'O' | 'K' | 'D' | 'F' | 'C' | 'P' | '!' | '@';

export type CommandId =
  | 'h' | 'j' | 'k' | 'l'
  | 'w' | 'b' | 'e'
  | '0' | '$'
  | 'gg' | 'G'
  | 'dd'
  | 'yy' | 'p'
  | 'ff'
  | 'count';

// Permanent upgrades, metroidvania-style: unlike CommandId (which teaches a
// new *keybinding*), an AbilityId changes what an *existing* motion can do
// (see the 'C'/'P' tile comments above) - deliberately no new keys to learn
// for either. Persists once granted regardless of which level is currently
// being played, including revisiting an earlier one - see
// GameController.recomputeUnlocked.
export type AbilityId = 'farjump' | 'phase';

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
  /**
   * Named warp targets for <space>ff, one per 'F' tile in the grid - kept
   * separate from the grid itself since a single ASCII cell can't carry a
   * whole filename. Position is given explicitly rather than derived by
   * scanning the grid so multiple 'F' tiles never need to be told apart by
   * scan order.
   */
  files?: { name: string; pos: Point; icon: string }[];
  /** Permanent ability granted on completing this level, if any - see AbilityId. */
  grantsAbility?: AbilityId;
}

export interface LevelState {
  grid: Tile[][];
  player: Point;
  start: Point;
  hasItem: boolean;
  moves: number;
  won: boolean;
}

import type { AbilityId, LevelDef, LevelState, Point, Tile } from './types.ts';

/**
 * Tiles that block step motions (h/j/k/l) but that jumps may land on.
 * 'P' (phase wall) is a hard wall like '#' until the Phase ability is
 * granted, at which point it drops out of every one of these checks
 * entirely (see isPhaseable below) - phasing doesn't just help jumps, it
 * makes the tile fully transparent to every motion, h/j/k/l included.
 */
function isWall(tile: Tile, abilities: ReadonlySet<AbilityId>): boolean {
  if (tile === 'P' && abilities.has('phase')) return false;
  return tile === '#' || tile === 'D' || tile === 'P';
}

/**
 * Tiles a *jump* (0 $ gg G w b e) may pass through / land on. Pits only
 * yield to jumps unconditionally; 'C' (chasm) is a harder version of a
 * pit that only yields once Far Jump is granted - before that it's a
 * hard wall to jumps too, same as '#'.
 */
function isJumpPassable(tile: Tile, abilities: ReadonlySet<AbilityId>): boolean {
  if (isWall(tile, abilities)) return false;
  if (tile === '~') return true;
  if (tile === 'C') return abilities.has('farjump');
  return true;
}

/**
 * Tiles that count as part of a "word" for w/b/e's own word-boundary
 * scan - distinct from jump-passability. A pit/chasm is always treated
 * as a separator, never fillable "word" content, regardless of whether
 * Far Jump makes it currently crossable - the same way '~' already
 * wasn't a word tile even though jumps could always cross it. A phase
 * wall is the opposite: before Phase it's exactly as solid as '#'
 * (never a word tile); after, it's indistinguishable from normal floor.
 */
function isWordTile(tile: Tile, abilities: ReadonlySet<AbilityId>): boolean {
  if (tile === '~' || tile === 'C') return false;
  if (tile === '#' || tile === 'D') return false;
  if (tile === 'P') return abilities.has('phase');
  return true;
}

export type ActionResult =
  | { kind: 'moved' }
  | { kind: 'blocked' }
  | { kind: 'zapped' }
  | { kind: 'picked-up' }
  | { kind: 'placed' }
  | { kind: 'cleared' }
  | { kind: 'secret-found' }
  | { kind: 'noop' }
  | { kind: 'won' };

function parseLevel(def: LevelDef): { grid: Tile[][]; start: Point } {
  const grid: Tile[][] = [];
  let start: Point = { x: 0, y: 0 };
  def.grid.forEach((rowStr, y) => {
    const row: Tile[] = [];
    [...rowStr].forEach((ch, x) => {
      if (ch === '@') {
        start = { x, y };
        row.push('.');
      } else {
        row.push(ch as Tile);
      }
    });
    grid.push(row);
  });
  return { grid, start };
}

/** Finds the single goal-bearing tile ('G' when open, or 'O' rubble covering it). */
function findGoal(grid: Tile[][]): Point {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === 'G' || grid[y][x] === 'O') return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export class Engine {
  state: LevelState;
  private goal: Point;
  private def: LevelDef;
  private abilities: ReadonlySet<AbilityId>;

  constructor(def: LevelDef, abilities: ReadonlySet<AbilityId> = new Set()) {
    this.def = def;
    this.abilities = abilities;
    const { grid, start } = parseLevel(def);
    this.goal = findGoal(grid);
    this.state = {
      grid,
      player: { ...start },
      start: { ...start },
      hasItem: false,
      moves: 0,
      won: false,
    };
  }

  reset() {
    const { grid, start } = parseLevel(this.def);
    this.state = {
      grid,
      player: { ...start },
      start: { ...start },
      hasItem: false,
      moves: 0,
      won: false,
    };
  }

  private tileAt(p: Point): Tile {
    return this.state.grid[p.y]?.[p.x] ?? '#';
  }

  private inBounds(p: Point): boolean {
    return p.y >= 0 && p.y < this.state.grid.length && p.x >= 0 && p.x < this.state.grid[p.y].length;
  }

  private checkWin(): boolean {
    const t = this.tileAt(this.goal);
    const onGoal = this.state.player.x === this.goal.x && this.state.player.y === this.goal.y;
    return onGoal && t !== 'O';
  }

  /**
   * A secret ('!') is consumed the moment you land on it, from any
   * motion - not just steps. Never blocks or competes with a win on the
   * same move (the two tiles are always distinct), so this only ever
   * matters when checkWin() didn't already fire.
   */
  private consumeSecret(p: Point): boolean {
    if (this.tileAt(p) !== '!') return false;
    this.state.grid[p.y][p.x] = '.';
    return true;
  }

  private arrive(): ActionResult {
    this.state.moves++;
    if (this.checkWin()) {
      this.state.won = true;
      return { kind: 'won' };
    }
    if (this.consumeSecret(this.state.player)) return { kind: 'secret-found' };
    return { kind: 'moved' };
  }

  /** Single-tile step: h/j/k/l. */
  step(dx: number, dy: number): ActionResult {
    const next: Point = { x: this.state.player.x + dx, y: this.state.player.y + dy };
    if (!this.inBounds(next) || isWall(this.tileAt(next), this.abilities)) return { kind: 'blocked' };
    if (this.tileAt(next) === '~' || this.tileAt(next) === 'C') return { kind: 'blocked' };
    if (this.tileAt(next) === 'X') {
      this.reset();
      return { kind: 'zapped' };
    }
    this.state.player = next;
    return this.arrive();
  }

  /** Casts a jump in direction (dx,dy), stopping just before a wall/closed-door/pit or the edge. */
  private castJump(dx: number, dy: number): Point {
    let cur = { ...this.state.player };
    for (;;) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      if (!this.inBounds(next) || !isJumpPassable(this.tileAt(next), this.abilities)) break;
      cur = next;
    }
    return cur;
  }

  private landJump(dest: Point): ActionResult {
    if (dest.x === this.state.player.x && dest.y === this.state.player.y) return { kind: 'blocked' };
    this.state.player = dest;
    return this.arrive();
  }

  lineStart(): ActionResult {
    return this.landJump(this.castJump(-1, 0));
  }

  lineEnd(): ActionResult {
    return this.landJump(this.castJump(1, 0));
  }

  top(): ActionResult {
    return this.landJump(this.castJump(0, -1));
  }

  bottom(): ActionResult {
    return this.landJump(this.castJump(0, 1));
  }

  private row(): Tile[] {
    return this.state.grid[this.state.player.y];
  }

  wordForward(): ActionResult {
    const row = this.row();
    const last = row.length - 1;
    let pos = this.state.player.x;
    if (isWordTile(row[pos], this.abilities)) {
      while (pos <= last && isWordTile(row[pos], this.abilities)) pos++;
    } else {
      pos++;
    }
    while (pos <= last && !isWordTile(row[pos], this.abilities)) pos++;
    if (pos > last) return { kind: 'blocked' };
    return this.landJump({ x: pos, y: this.state.player.y });
  }

  wordEnd(): ActionResult {
    const row = this.row();
    const last = row.length - 1;
    let pos = this.state.player.x + 1;
    while (pos <= last && !isWordTile(row[pos], this.abilities)) pos++;
    if (pos > last) return { kind: 'blocked' };
    while (pos + 1 <= last && isWordTile(row[pos + 1], this.abilities)) pos++;
    return this.landJump({ x: pos, y: this.state.player.y });
  }

  wordBack(): ActionResult {
    const row = this.row();
    let pos = this.state.player.x - 1;
    while (pos >= 0 && !isWordTile(row[pos], this.abilities)) pos--;
    if (pos < 0) return { kind: 'blocked' };
    while (pos - 1 >= 0 && isWordTile(row[pos - 1], this.abilities)) pos--;
    return this.landJump({ x: pos, y: this.state.player.y });
  }

  /** dd: clears rubble on the current tile. */
  destroy(): ActionResult {
    const p = this.state.player;
    if (this.tileAt(p) === 'O') {
      this.state.grid[p.y][p.x] = '.';
      if (this.checkWin()) {
        this.state.won = true;
        return { kind: 'won' };
      }
      return { kind: 'cleared' };
    }
    return { kind: 'noop' };
  }

  /** yy: picks up a key/item on the current tile. */
  yank(): ActionResult {
    const p = this.state.player;
    if (this.tileAt(p) === 'K' && !this.state.hasItem) {
      this.state.grid[p.y][p.x] = '.';
      this.state.hasItem = true;
      return { kind: 'picked-up' };
    }
    return { kind: 'noop' };
  }

  /**
   * <space>ff: warps straight to an arbitrary point, bypassing every
   * other action's wall/hazard/pit/door checks entirely - unlike every
   * other motion here, a fuzzy-finder jump isn't a *path* through the
   * level, it's picking a destination by name and landing there. That's
   * the actual thing this command is teaching: it's a categorically
   * bigger jump than 0/$/gg/G, not just a longer-range version of them.
   */
  warp(dest: Point): ActionResult {
    if (!this.inBounds(dest)) return { kind: 'blocked' };
    this.state.player = { ...dest };
    return this.arrive();
  }

  /** p: places a held item into an adjacent door, opening it. */
  put(): ActionResult {
    if (!this.state.hasItem) return { kind: 'noop' };
    const { x, y } = this.state.player;
    const neighbors: Point[] = [
      { x, y: y - 1 },
      { x, y: y + 1 },
      { x: x - 1, y },
      { x: x + 1, y },
    ];
    let opened = false;
    for (const n of neighbors) {
      if (this.inBounds(n) && this.tileAt(n) === 'D') {
        this.state.grid[n.y][n.x] = '.';
        opened = true;
      }
    }
    if (opened) {
      this.state.hasItem = false;
      return { kind: 'placed' };
    }
    return { kind: 'noop' };
  }
}

import type { LevelDef, LevelState, Point, Tile } from './types.ts';

/** Tiles that block step motions (h/j/k/l) but that jumps may land on. */
function isWall(tile: Tile): boolean {
  return tile === '#' || tile === 'D';
}

/** Tiles a *jump* (0 $ gg G) may pass through / land on. Pits only yield to word motions. */
function isJumpPassable(tile: Tile): boolean {
  return tile !== '#' && tile !== 'D' && tile !== '~';
}

/** Tiles that count as part of a "word" for w/b/e. */
function isWordTile(tile: Tile): boolean {
  return tile !== '#' && tile !== '~' && tile !== 'D';
}

export type ActionResult =
  | { kind: 'moved' }
  | { kind: 'blocked' }
  | { kind: 'zapped' }
  | { kind: 'picked-up' }
  | { kind: 'placed' }
  | { kind: 'cleared' }
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

  constructor(def: LevelDef) {
    this.def = def;
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

  /** Single-tile step: h/j/k/l. */
  step(dx: number, dy: number): ActionResult {
    const next: Point = { x: this.state.player.x + dx, y: this.state.player.y + dy };
    if (!this.inBounds(next) || isWall(this.tileAt(next))) return { kind: 'blocked' };
    if (this.tileAt(next) === '~') return { kind: 'blocked' };
    if (this.tileAt(next) === 'X') {
      this.reset();
      return { kind: 'zapped' };
    }
    this.state.player = next;
    this.state.moves++;
    if (this.checkWin()) {
      this.state.won = true;
      return { kind: 'won' };
    }
    return { kind: 'moved' };
  }

  /** Casts a jump in direction (dx,dy), stopping just before a wall/closed-door/pit or the edge. */
  private castJump(dx: number, dy: number): Point {
    let cur = { ...this.state.player };
    for (;;) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      if (!this.inBounds(next) || !isJumpPassable(this.tileAt(next))) break;
      cur = next;
    }
    return cur;
  }

  private landJump(dest: Point): ActionResult {
    if (dest.x === this.state.player.x && dest.y === this.state.player.y) return { kind: 'blocked' };
    this.state.player = dest;
    this.state.moves++;
    if (this.checkWin()) {
      this.state.won = true;
      return { kind: 'won' };
    }
    return { kind: 'moved' };
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
    if (isWordTile(row[pos])) {
      while (pos <= last && isWordTile(row[pos])) pos++;
    } else {
      pos++;
    }
    while (pos <= last && !isWordTile(row[pos])) pos++;
    if (pos > last) return { kind: 'blocked' };
    return this.landJump({ x: pos, y: this.state.player.y });
  }

  wordEnd(): ActionResult {
    const row = this.row();
    const last = row.length - 1;
    let pos = this.state.player.x + 1;
    while (pos <= last && !isWordTile(row[pos])) pos++;
    if (pos > last) return { kind: 'blocked' };
    while (pos + 1 <= last && isWordTile(row[pos + 1])) pos++;
    return this.landJump({ x: pos, y: this.state.player.y });
  }

  wordBack(): ActionResult {
    const row = this.row();
    let pos = this.state.player.x - 1;
    while (pos >= 0 && !isWordTile(row[pos])) pos--;
    if (pos < 0) return { kind: 'blocked' };
    while (pos - 1 >= 0 && isWordTile(row[pos - 1])) pos--;
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

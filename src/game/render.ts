import type { LevelState, Tile } from './types.ts';

const TILE_CLASS: Record<Tile, string> = {
  '#': 'wall',
  '.': 'floor',
  G: 'goal',
  X: 'hazard',
  '~': 'pit',
  O: 'rubble',
  K: 'key',
  D: 'door',
  '@': 'floor',
};

export function renderGrid(container: HTMLElement, state: LevelState) {
  const { grid, player } = state;
  const cols = grid[0]?.length ?? 0;
  container.style.setProperty('--cols', String(cols));
  container.style.setProperty('--rows', String(grid.length));

  let html = '';
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const isPlayer = x === player.x && y === player.y;
      const tile = grid[y][x];
      const cls = TILE_CLASS[tile] ?? 'floor';
      const char = isPlayer ? '@' : tile === '.' ? '' : tile;
      html += `<div class="cell ${cls}${isPlayer ? ' player' : ''}">${char}</div>`;
    }
  }
  container.innerHTML = html;
}

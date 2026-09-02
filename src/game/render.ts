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
  F: 'file',
  C: 'chasm',
  P: 'phasewall',
  '!': 'secret',
  '@': 'floor',
};

/**
 * `fileIcons` maps "x,y" -> that position's file icon (see LevelDef.files)
 * - only 'F' tiles ever look it up, so every other tile ignores it
 * entirely. Optional: levels with no files array just render a plain 'F'.
 */
export function renderGrid(container: HTMLElement, state: LevelState, fileIcons?: Map<string, string>) {
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
      const icon = tile === 'F' ? fileIcons?.get(`${x},${y}`) : undefined;
      const char = isPlayer ? '@' : icon ?? (tile === '.' ? '' : tile);
      html += `<div class="cell ${cls}${isPlayer ? ' player' : ''}">${char}</div>`;
    }
  }
  container.innerHTML = html;
}

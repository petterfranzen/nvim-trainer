import type { AbilityId, CommandId, CommandInfo } from './types.ts';

export const ALL_COMMANDS: CommandInfo[] = [
  { id: 'h', keys: 'h', description: 'move left' },
  { id: 'j', keys: 'j', description: 'move down' },
  { id: 'k', keys: 'k', description: 'move up' },
  { id: 'l', keys: 'l', description: 'move right' },
  { id: '0', keys: '0', description: 'jump to start of row' },
  { id: '$', keys: '$', description: 'jump to end of row' },
  { id: 'w', keys: 'w', description: 'jump to next word' },
  { id: 'b', keys: 'b', description: 'jump to previous word' },
  { id: 'e', keys: 'e', description: 'jump to end of word' },
  { id: 'gg', keys: 'gg', description: 'jump to top of level' },
  { id: 'G', keys: 'G', description: 'jump to bottom of level' },
  { id: 'dd', keys: 'dd', description: 'clear rubble on this tile' },
  { id: 'yy', keys: 'yy', description: 'pick up item on this tile' },
  { id: 'p', keys: 'p', description: 'place held item into adjacent door' },
  { id: 'ff', keys: '<space>ff', description: 'find and warp straight to a named file' },
  { id: 'count', keys: '1-9 + motion', description: 'repeat a motion, e.g. 3l' },
];

const BY_ID = new Map(ALL_COMMANDS.map((c) => [c.id, c] as const));

export function commandInfo(id: CommandId): CommandInfo {
  const info = BY_ID.get(id);
  if (!info) throw new Error(`Unknown command id: ${id}`);
  return info;
}

// Abilities have no keybinding of their own (see AbilityId's own comment
// in types.ts) - just a name shown once, on the level-complete card that
// grants them.
export const ABILITY_NAMES: Record<AbilityId, string> = {
  farjump: 'Far Jump - jumps now cross chasms (C)',
  phase: 'Phase - h/j/k/l now pass straight through phase walls (P)',
};

/** Compact form for the persistent HUD badge - ABILITY_NAMES is for the one-time level-complete card. */
export const ABILITY_SHORT_NAMES: Record<AbilityId, string> = {
  farjump: 'Far Jump',
  phase: 'Phase',
};

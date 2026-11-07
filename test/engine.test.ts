import { describe, it, expect } from 'vitest';
import { Engine } from '../src/game/engine.ts';
import type { AbilityId, LevelDef } from '../src/game/types.ts';

function level(grid: string[], extra: Partial<LevelDef> = {}): LevelDef {
  return { id: 1, title: 'test', unlocks: [], hint: '', grid, ...extra };
}

const none = new Set<AbilityId>();
const farjump = new Set<AbilityId>(['farjump']);
const phase = new Set<AbilityId>(['phase']);

describe('Engine - ability-gated passability', () => {
  describe('hazard (X): zaps a step, but jumps sail over it', () => {
    const def = level(['#######', '#@X..G#', '#######']);

    it('a single-tile step onto a hazard resets the player to the start', () => {
      const e = new Engine(def, none);
      expect(e.step(1, 0)).toEqual({ kind: 'zapped' });
      expect(e.state.player).toEqual({ x: 1, y: 1 });
      expect(e.state.moves).toBe(0);
    });

    it('a jump motion crosses the hazard and lands on the goal', () => {
      const e = new Engine(def, none);
      expect(e.lineEnd()).toEqual({ kind: 'won' });
      expect(e.state.player).toEqual({ x: 5, y: 1 });
    });
  });

  describe('pit (~): blocks steps, always yields to jumps', () => {
    const def = level(['#######', '#@~..G#', '#######']);

    it('blocks a step regardless of abilities', () => {
      expect(new Engine(def, none).step(1, 0)).toEqual({ kind: 'blocked' });
      expect(new Engine(def, farjump).step(1, 0)).toEqual({ kind: 'blocked' });
    });

    it('is crossed by a jump with no ability needed', () => {
      expect(new Engine(def, none).lineEnd()).toEqual({ kind: 'won' });
    });
  });

  describe('chasm (C): impassable to everything until Far Jump', () => {
    const def = level(['#######', '#@C..G#', '#######']);

    it('blocks steps and jumps without the ability', () => {
      const e = new Engine(def, none);
      expect(e.step(1, 0)).toEqual({ kind: 'blocked' });
      expect(e.lineEnd()).toEqual({ kind: 'blocked' });
      expect(e.state.player).toEqual({ x: 1, y: 1 });
      expect(e.state.won).toBe(false);
    });

    it('still blocks a step with Far Jump, but a jump now crosses it', () => {
      const e = new Engine(def, farjump);
      expect(e.step(1, 0)).toEqual({ kind: 'blocked' });
      expect(e.lineEnd()).toEqual({ kind: 'won' });
    });
  });

  describe('phase wall (P): impassable to everything until Phase', () => {
    const def = level(['#######', '#@P..G#', '#######']);

    it('blocks steps and jumps without the ability', () => {
      const e = new Engine(def, none);
      expect(e.step(1, 0)).toEqual({ kind: 'blocked' });
      expect(e.lineEnd()).toEqual({ kind: 'blocked' });
    });

    it('becomes ordinary floor to walking and jumping once Phase is granted', () => {
      const walker = new Engine(def, phase);
      expect(walker.step(1, 0)).toEqual({ kind: 'moved' });
      expect(walker.state.player).toEqual({ x: 2, y: 1 });

      expect(new Engine(def, phase).lineEnd()).toEqual({ kind: 'won' });
    });
  });

  describe('win detection', () => {
    it('wins on arriving at the uncovered goal', () => {
      const e = new Engine(level(['#####', '#@.G#', '#####']), none);
      expect(e.step(1, 0)).toEqual({ kind: 'moved' });
      expect(e.step(1, 0)).toEqual({ kind: 'won' });
      expect(e.state.won).toBe(true);
    });

    it('does not win while the goal is still buried in rubble', () => {
      const e = new Engine(level(['#####', '#@O.#', '#####']), none);
      expect(e.step(1, 0)).toEqual({ kind: 'moved' }); // standing on rubble is fine
      expect(e.state.won).toBe(false);
      expect(e.destroy()).toEqual({ kind: 'won' }); // dd clears it
      expect(e.state.won).toBe(true);
    });

    it('destroy on plain floor is a no-op', () => {
      expect(new Engine(level(['#####', '#@..#', '#####']), none).destroy()).toEqual({ kind: 'noop' });
    });
  });

  describe('other gates', () => {
    it('a door (D) blocks a step until it is opened', () => {
      expect(new Engine(level(['#####', '#@D.#', '#####']), none).step(1, 0)).toEqual({ kind: 'blocked' });
    });

    it('<space>ff warps straight past walls to any in-bounds destination', () => {
      const e = new Engine(level(['#####', '#@#G#', '#####']), none);
      expect(e.warp({ x: 3, y: 1 })).toEqual({ kind: 'won' });
    });

    it('a warp out of bounds is blocked and leaves the player put', () => {
      const e = new Engine(level(['#####', '#@.G#', '#####']), none);
      expect(e.warp({ x: 99, y: 1 })).toEqual({ kind: 'blocked' });
      expect(e.state.player).toEqual({ x: 1, y: 1 });
    });
  });
});

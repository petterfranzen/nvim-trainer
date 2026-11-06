#!/usr/bin/env node
// Level-invariant tests for VIM QUEST.
//
// The Playwright playtests (scripts/playtest.mjs, playtest-edge.mjs) walk the
// *intended* path through every level. They prove the game is winnable, but
// they cannot prove a level only *accepts* its intended solution: a level
// whose new command turns out to be unnecessary - some earlier, already
// unlocked motion happens to reach the goal on its own - still ships green.
//
// These invariants close that gap. They do not drive a browser: they import
// the real Engine and the real LevelDefs, search the level's whole state space
// with the game's own motion rules, and assert:
//
//   1. every level is solvable with the commands/abilities unlocked by the
//      time it is reached (nothing is an impossible level);
//   2. a level that teaches a new command cannot be completed with only the
//      commands unlocked *before* it - the new command is strictly required,
//      the contract README.md states ("requires you to use that command to
//      solve the level");
//   3. the ability-gated levels really need their ability (chasm 'C' -> Far
//      Jump, phase wall 'P' -> Phase), while level 10's two sealed shafts stay
//      optional so reaching them by backtracking is still the reward it is;
//   4. chasms and phase walls behave as designed at the tile level - a chasm
//      blocks walking always and jumps until Far Jump; a phase wall blocks
//      every motion until Phase, then none.
//
// Node runs the TypeScript sources directly (type stripping; Node >= 23.6, or
// 22.6+ with --experimental-strip-types), so there is no build step:
// `npm run invariants`.
import { Engine } from '../src/game/engine.ts';
import { LEVELS } from '../src/game/levels.ts';

// ---------------------------------------------------------------------------
// Motion catalogue - the same engine calls GameController.dispatch() wires keys
// to (see src/game/controller.ts).
// ---------------------------------------------------------------------------
const ACTIONS = {
  h: (e) => e.step(-1, 0),
  j: (e) => e.step(0, 1),
  k: (e) => e.step(0, -1),
  l: (e) => e.step(1, 0),
  w: (e) => e.wordForward(),
  b: (e) => e.wordBack(),
  e: (e) => e.wordEnd(),
  0: (e) => e.lineStart(),
  $: (e) => e.lineEnd(),
  gg: (e) => e.top(),
  G: (e) => e.bottom(),
  dd: (e) => e.destroy(),
  yy: (e) => e.yank(),
  p: (e) => e.put(),
};

// Commands that are not a motion a later level could be forced to require.
// 'count' is a repeat-a-motion tip revealed on the final level.
const NON_TEACHING = new Set(['count']);

// ---------------------------------------------------------------------------
// Unlock bookkeeping - mirrors GameController.recomputeUnlocked(): the commands
// and abilities available on reaching level `index` are the union of every
// unlocks/grantsAbility at or before it.
// ---------------------------------------------------------------------------
function unlockedUpTo(index) {
  const commands = new Set();
  const abilities = new Set();
  for (let i = 0; i <= index && i < LEVELS.length; i++) {
    for (const c of LEVELS[i].unlocks) commands.add(c);
    if (LEVELS[i].grantsAbility) abilities.add(LEVELS[i].grantsAbility);
  }
  // The count tip is revealed on the last level and, like everything else,
  // stays available afterwards.
  if (index >= LEVELS.length - 1) commands.add('count');
  return { commands, abilities };
}

function without(set, drop) {
  const next = new Set(set);
  next.delete(drop);
  return next;
}

/**
 * Breadth-first search of a level's reachable states, using the real Engine so
 * the rules under test are the rules that ship. Moves are the given command
 * ids, plus one warp action per named file when `<space>ff` is available.
 * Returns which commands can reach the goal, each with one shortest move list,
 * and whether the goal is reachable at all.
 */
function explore(def, abilities, commands) {
  const actions = [];
  for (const id of commands) {
    const run = ACTIONS[id];
    if (run) actions.push({ id, label: id, run });
  }
  if (commands.has('ff')) {
    for (const file of def.files ?? []) {
      actions.push({ id: 'ff', label: `ff->${file.name}`, run: (e) => e.warp(file.pos) });
    }
  }

  const engine = new Engine(def, abilities);
  const key = (s) => JSON.stringify([s.player, s.hasItem, s.grid]);
  const queue = [{ state: structuredClone(engine.state), path: [] }];
  const seen = new Set([key(engine.state)]);
  const winners = new Map(); // command id -> a shortest move list that wins with it

  while (queue.length) {
    const { state, path } = queue.shift();
    for (const action of actions) {
      engine.state = structuredClone(state);
      let result;
      try {
        result = action.run(engine);
      } catch (err) {
        throw new Error(`level "${def.title}": moving with ${action.id} threw: ${err.message}`);
      }
      if (result.kind === 'won') {
        if (!winners.has(action.id)) winners.set(action.id, [...path, action.label]);
        continue;
      }
      const next = engine.state;
      const k = key(next);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ state: structuredClone(next), path: [...path, action.label] });
      }
    }
  }

  const paths = [...winners.values()].sort((a, b) => a.length - b.length);
  return {
    solvable: winners.size > 0,
    winners: [...winners.keys()].sort(),
    paths,
    shortest: paths[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Synthetic one-row probes for the tile rules themselves. Start is x1, the
// terrain sits at x5..x8, the goal is the far end, walls close both rows above
// and below so only horizontal motion matters.
// ---------------------------------------------------------------------------
const probeRow = (row) => ({ id: 0, title: 'probe', unlocks: [], hint: '', grid: ['#'.repeat(row.length), row, '#'.repeat(row.length)] });
const CHASM_ROW = '#@..CCCC..G#';
const PHASE_ROW = '#@..PPPP..G#';

const ALL_MOTIONS = ['h', 'j', 'k', 'l', '0', '$', 'gg', 'G', 'w', 'b', 'e'];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passes = 0;
let failures = 0;
const section = (t) => console.log(`\n${t}`);
const ok = (m) => { passes++; console.log(`  ok   - ${m}`); };
const fail = (m) => { failures++; console.log(`  FAIL - ${m}`); };
const check = (cond, m) => cond ? ok(m) : fail(m);

function main() {
  section('== per level: solvable, and the new command is actually required ==');
  for (let i = 0; i < LEVELS.length; i++) {
    const def = LEVELS[i];
    const label = `L${def.id} "${def.title}"`;
    const own = unlockedUpTo(i);
    const self = explore(def, own.abilities, own.commands);
    check(self.solvable, `${label}: solvable with the commands unlocked by this level${self.shortest ? ` (e.g. ${self.shortest.join(' ')})` : ''}`);

    const taught = def.unlocks.filter((c) => !NON_TEACHING.has(c));
    if (taught.length === 0) continue;

    // The new command must appear somewhere in a winning solution (it is not
    // a dead unlock), and the level must not be winnable without it.
    const usesNew = self.paths.some((p) => p.some((m) => taught.includes(m.split('->')[0])));
    check(usesNew, `${label}: a winning solution uses a new command (${taught.join('/')})`);

    const before = unlockedUpTo(i - 1);
    const pre = explore(def, before.abilities, before.commands);
    check(
      !pre.solvable,
      pre.solvable
        ? `${label}: bypassable without ${taught.join('/')} - ${pre.winners.join(', ')} reaches the goal alone (e.g. ${pre.shortest.join(' ')})`
        : `${label}: cannot be completed with only the commands unlocked before it`,
    );
  }

  section('== chasm and phase-wall gates ==');
  // 'withoutCommands' lets a level whose on-foot route needs an ability but
  // whose sealed vault is opened by <space>ff (level 17) still assert the
  // on-foot requirement: take the warp away and the ability becomes mandatory.
  const REQUIRES = {
    12: { abilities: ['farjump'] },
    15: { abilities: ['phase'] },
    16: { abilities: ['farjump', 'phase'] },
    17: { abilities: ['farjump', 'phase'], withoutCommands: ['ff'] },
  };
  for (const [id, spec] of Object.entries(REQUIRES)) {
    const def = LEVELS[id - 1];
    const own = unlockedUpTo(def.id - 1);
    const commands = without(own.commands, 'ff');
    const scoped = (spec.withoutCommands ?? []).includes('ff') ? commands : own.commands;
    for (const ability of spec.abilities) {
      check(own.abilities.has(ability), `L${def.id} "${def.title}": ${ability} is granted before this level`);
      check(!explore(def, without(own.abilities, ability), scoped).solvable, `L${def.id} "${def.title}": requires ${ability}${spec.withoutCommands ? ' on foot (without <space>ff)' : ''} (unsolvable without it)`);
    }
  }
  {
    const def = LEVELS[9];
    const own = unlockedUpTo(9);
    for (const ability of ['farjump', 'phase']) {
      check(explore(def, without(own.abilities, ability), own.commands).solvable, `L${def.id} "${def.title}": clearable without ${ability} (its sealed shaft is optional, not a gate)`);
    }
  }

  section('== chasm tile behaviour ==');
  {
    const def = probeRow(CHASM_ROW);
    const noFar = new Engine(def, new Set());
    noFar.state.player = { x: 4, y: 1 };
    check(noFar.step(1, 0).kind === 'blocked', 'a chasm blocks a step (h/j/k/l) before Far Jump');
    const far = new Engine(def, new Set(['farjump']));
    far.state.player = { x: 3, y: 1 };
    check(far.step(1, 0).kind === 'blocked', 'a chasm still blocks a step after Far Jump');
    const noFarJump = new Engine(def, new Set());
    noFarJump.state.player = { x: 3, y: 1 };
    noFarJump.lineEnd();
    check(noFarJump.state.player.x === 3, 'before Far Jump, $ cannot cross a chasm');
    check(!explore(def, new Set(), new Set(ALL_MOTIONS)).solvable, 'before Far Jump, the chasm row is unsolvable by any motion');
    const farJump = new Engine(def, new Set(['farjump']));
    farJump.state.player = { x: 3, y: 1 };
    check(farJump.lineEnd().kind === 'won', 'after Far Jump, $ crosses the chasm to the goal');
    check(explore(def, new Set(['farjump']), new Set(ALL_MOTIONS)).solvable, 'after Far Jump, the chasm row is solvable');
  }

  section('== phase-wall tile behaviour ==');
  {
    const def = probeRow(PHASE_ROW);
    const noPhase = new Engine(def, new Set());
    noPhase.state.player = { x: 4, y: 1 };
    check(noPhase.step(1, 0).kind === 'blocked', 'a phase wall blocks a step before Phase');
    noPhase.lineEnd();
    check(noPhase.state.player.x === 4, 'before Phase, a jump cannot cross a phase wall');
    check(!explore(def, new Set(), new Set(ALL_MOTIONS)).solvable, 'before Phase, the phase-wall row is unsolvable by any motion');
    const phase = new Engine(def, new Set(['phase']));
    phase.state.player = { x: 4, y: 1 };
    check(phase.step(1, 0).kind === 'moved' && phase.state.player.x === 5, 'after Phase, a step walks onto a phase wall');
    const phaseJump = new Engine(def, new Set(['phase']));
    phaseJump.state.player = { x: 1, y: 1 };
    check(phaseJump.lineEnd().kind === 'won', 'after Phase, $ crosses the phase wall to the goal');
    check(explore(def, new Set(['phase']), new Set(['h', 'j', 'k', 'l'])).solvable, 'after Phase, plain h/j/k/l alone cross the phase-wall row');
  }

  section('== baseline tile rules the levels rely on ==');
  {
    const hazard = new Engine(probeRow('#@.X..G#'), new Set());
    hazard.state.player = { x: 2, y: 1 };
    check(hazard.step(1, 0).kind === 'zapped', 'stepping onto a hazard (X) zaps you back to the start');
    const hazardJump = new Engine(probeRow('#@.X..G#'), new Set());
    hazardJump.state.player = { x: 1, y: 1 };
    check(hazardJump.lineEnd().kind === 'won', 'a jump sails clean over a hazard');
    const pit = new Engine(probeRow('#@.~~.G#'), new Set());
    pit.state.player = { x: 2, y: 1 };
    check(pit.step(1, 0).kind === 'blocked', 'a pit (~) blocks a step');
    const pitJump = new Engine(probeRow('#@.~~.G#'), new Set());
    pitJump.state.player = { x: 1, y: 1 };
    check(pitJump.lineEnd().kind === 'won', 'a jump crosses a pit');
  }

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) {
    console.error('\nINVARIANT FAILURES');
    process.exit(1);
  }
}

main();

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
  const actions = buildActions(def, commands);
  const engine = new Engine(def, abilities);
  const queue = [{ state: structuredClone(engine.state), path: [] }];
  const seen = new Set([stateKey(engine.state)]);
  const winners = new Map(); // command id -> a shortest move list that wins with it

  while (queue.length) {
    const from = queue.shift();
    for (const action of actions) {
      const next = tryAction(engine, def, from, action, winners);
      if (next && isNewState(seen, next.state)) queue.push(next);
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

/** The moves a search may make: one per known command, one warp per named file. */
function buildActions(def, commands) {
  const actions = [...commands]
    .filter((id) => ACTIONS[id])
    .map((id) => ({ id, label: id, run: ACTIONS[id] }));
  if (!commands.has('ff')) return actions;
  const warps = (def.files ?? []).map((file) => ({ id: 'ff', label: `ff->${file.name}`, run: (e) => e.warp(file.pos) }));
  return [...actions, ...warps];
}

const stateKey = (s) => JSON.stringify([s.player, s.hasItem, s.grid]);

/** Records `state` as seen; true when it had not been reached before. */
function isNewState(seen, state) {
  const k = stateKey(state);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
}

/**
 * Applies one action from a queued state. A win is recorded in `winners`
 * (first, so shortest, path per command) and yields nothing to explore;
 * anything else yields the resulting state and the path that reached it.
 */
function tryAction(engine, def, from, action, winners) {
  engine.state = structuredClone(from.state);
  const path = [...from.path, action.label];
  if (runAction(engine, def, action).kind !== 'won') return { state: structuredClone(engine.state), path };
  if (!winners.has(action.id)) winners.set(action.id, path);
  return null;
}

function runAction(engine, def, action) {
  try {
    return action.run(engine);
  } catch (err) {
    throw new Error(`level "${def.title}": moving with ${action.id} threw: ${err.message}`);
  }
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

// A probe engine with the player placed at column `x` of the single open row.
function probeAt(def, abilities, x) {
  const engine = new Engine(def, new Set(abilities));
  engine.state.player = { x, y: 1 };
  return engine;
}

const probeSolvable = (def, abilities, motions) => explore(def, new Set(abilities), new Set(motions)).solvable;

function checkLevel(i) {
  const def = LEVELS[i];
  const label = `L${def.id} "${def.title}"`;
  const own = unlockedUpTo(i);
  const self = explore(def, own.abilities, own.commands);
  const example = self.shortest ? ` (e.g. ${self.shortest.join(' ')})` : '';
  check(self.solvable, `${label}: solvable with the commands unlocked by this level${example}`);

  const taught = def.unlocks.filter((c) => !NON_TEACHING.has(c));
  if (taught.length === 0) return;

  // The new command must appear somewhere in a winning solution (it is not
  // a dead unlock), and the level must not be winnable without it.
  const usesNew = self.paths.some((p) => p.some((m) => taught.includes(m.split('->')[0])));
  check(usesNew, `${label}: a winning solution uses a new command (${taught.join('/')})`);

  const before = unlockedUpTo(i - 1);
  const pre = explore(def, before.abilities, before.commands);
  check(!pre.solvable, bypassMessage(label, taught, pre));
}

function bypassMessage(label, taught, pre) {
  if (!pre.solvable) return `${label}: cannot be completed with only the commands unlocked before it`;
  return `${label}: bypassable without ${taught.join('/')} - ${pre.winners.join(', ')} reaches the goal alone (e.g. ${pre.shortest.join(' ')})`;
}

// 'withoutCommands' lets a level whose on-foot route needs an ability but
// whose sealed vault is opened by <space>ff (level 17) still assert the
// on-foot requirement: take the warp away and the ability becomes mandatory.
const REQUIRES = {
  12: { abilities: ['farjump'] },
  15: { abilities: ['phase'] },
  16: { abilities: ['farjump', 'phase'] },
  17: { abilities: ['farjump', 'phase'], withoutCommands: ['ff'] },
};

function checkRequiredAbilities(id, spec) {
  const def = LEVELS[id - 1];
  const label = `L${def.id} "${def.title}"`;
  const own = unlockedUpTo(def.id - 1);
  const onFoot = (spec.withoutCommands ?? []).includes('ff');
  const scoped = onFoot ? without(own.commands, 'ff') : own.commands;
  const suffix = spec.withoutCommands ? ' on foot (without <space>ff)' : '';
  for (const ability of spec.abilities) {
    check(own.abilities.has(ability), `${label}: ${ability} is granted before this level`);
    check(!explore(def, without(own.abilities, ability), scoped).solvable, `${label}: requires ${ability}${suffix} (unsolvable without it)`);
  }
}

function checkOptionalShafts() {
  const def = LEVELS[9];
  const own = unlockedUpTo(9);
  for (const ability of ['farjump', 'phase']) {
    check(explore(def, without(own.abilities, ability), own.commands).solvable, `L${def.id} "${def.title}": clearable without ${ability} (its sealed shaft is optional, not a gate)`);
  }
}

function checkChasmTiles() {
  const def = probeRow(CHASM_ROW);
  check(probeAt(def, [], 4).step(1, 0).kind === 'blocked', 'a chasm blocks a step (h/j/k/l) before Far Jump');
  check(probeAt(def, ['farjump'], 3).step(1, 0).kind === 'blocked', 'a chasm still blocks a step after Far Jump');
  const noFarJump = probeAt(def, [], 3);
  noFarJump.lineEnd();
  check(noFarJump.state.player.x === 3, 'before Far Jump, $ cannot cross a chasm');
  check(!probeSolvable(def, [], ALL_MOTIONS), 'before Far Jump, the chasm row is unsolvable by any motion');
  check(probeAt(def, ['farjump'], 3).lineEnd().kind === 'won', 'after Far Jump, $ crosses the chasm to the goal');
  check(probeSolvable(def, ['farjump'], ALL_MOTIONS), 'after Far Jump, the chasm row is solvable');
}

function checkPhaseTiles() {
  const def = probeRow(PHASE_ROW);
  const noPhase = probeAt(def, [], 4);
  check(noPhase.step(1, 0).kind === 'blocked', 'a phase wall blocks a step before Phase');
  noPhase.lineEnd();
  check(noPhase.state.player.x === 4, 'before Phase, a jump cannot cross a phase wall');
  check(!probeSolvable(def, [], ALL_MOTIONS), 'before Phase, the phase-wall row is unsolvable by any motion');
  const phase = probeAt(def, ['phase'], 4);
  const walked = phase.step(1, 0).kind === 'moved';
  check(walked && phase.state.player.x === 5, 'after Phase, a step walks onto a phase wall');
  check(probeAt(def, ['phase'], 1).lineEnd().kind === 'won', 'after Phase, $ crosses the phase wall to the goal');
  check(probeSolvable(def, ['phase'], ['h', 'j', 'k', 'l']), 'after Phase, plain h/j/k/l alone cross the phase-wall row');
}

function checkBaselineTiles() {
  const hazard = probeRow('#@.X..G#');
  check(probeAt(hazard, [], 2).step(1, 0).kind === 'zapped', 'stepping onto a hazard (X) zaps you back to the start');
  check(probeAt(hazard, [], 1).lineEnd().kind === 'won', 'a jump sails clean over a hazard');
  const pit = probeRow('#@.~~.G#');
  check(probeAt(pit, [], 2).step(1, 0).kind === 'blocked', 'a pit (~) blocks a step');
  check(probeAt(pit, [], 1).lineEnd().kind === 'won', 'a jump crosses a pit');
}

function main() {
  section('== per level: solvable, and the new command is actually required ==');
  for (let i = 0; i < LEVELS.length; i++) checkLevel(i);

  section('== chasm and phase-wall gates ==');
  for (const [id, spec] of Object.entries(REQUIRES)) checkRequiredAbilities(id, spec);
  checkOptionalShafts();

  section('== chasm tile behaviour ==');
  checkChasmTiles();

  section('== phase-wall tile behaviour ==');
  checkPhaseTiles();

  section('== baseline tile rules the levels rely on ==');
  checkBaselineTiles();

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) {
    console.error('\nINVARIANT FAILURES');
    process.exit(1);
  }
}

main();

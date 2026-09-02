# VIM QUEST

An ASCII, browser-based platformer that teaches real Vim motions. You move
and act on an `@` character across text-mode levels using actual Vim
keybindings - not arrow keys, not WASD-with-vim-labels. Each level unlocks
one new command family, gives you a one-line in-level hint, and then
requires you to use that command to solve the level. Deeper in, two
permanent upgrades change what those same commands can *do* rather than
adding new ones to learn - see "Permanent upgrades and backtracking" below.

## Why this exists

Vim motions only become muscle memory once chaining them stops feeling like
translation. This is a small, focused way to drill `hjkl`, word motions,
line/file jumps, and two "operator" actions in a context where using the
right command is the fastest (and sometimes only) way to win.

## Tech stack

**Vite + vanilla TypeScript, no framework, no backend.** The whole game is
a small, synchronous state machine (parse a level's ASCII grid, mutate a
`player` position on keypress, re-render a DOM grid) - there's no shared
mutable UI state complex enough to justify React/Vue's diffing model, and no
data that needs to survive a server round-trip. Vite gives fast HMR and a
trivial static build; TypeScript catches the class of bugs this project is
most exposed to (off-by-one grid coordinates, tile-type typos). Progress is
persisted to `localStorage` - there's nothing here that needs an account or
a database.

## How to run it

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). Click
**Start Game** and play with your keyboard.

Other scripts:

```bash
npm run build          # production build to dist/
npm run preview        # preview the production build
npm run playtest       # headless Playwright run through all 17 levels
npm run playtest:edge  # headless check of locked-command feedback, save/continue, the finder, and backtracking
```

The playtest scripts need a dev server already running (`npm run dev`) and
Playwright's Chromium (`npx playwright install chromium`, if not already
present) - they exist as an automated regression check that every level is
actually solvable with its intended key sequence, not just a manual
smoke test.

## How to play

- Move with `h` `j` `k` `l`. Not the arrow keys - the game does not listen
  to them.
- A brief hint at the top of each level explains what's new.
- The legend below the hint always shows every command you've unlocked so
  far and what it does.
- Progress (which levels you've completed) is saved to your browser's
  `localStorage`, so closing the tab is safe.
- The title screen lists every level you've unlocked, not just the
  furthest one - pick any of them to replay it, which is how backtracking
  for a permanent upgrade's secrets actually works (see below).

### Command reference

| Keys | Effect |
|---|---|
| `h` `j` `k` `l` | Step left / down / up / right, one tile at a time. |
| `0` | Jump to the start of the current row. |
| `$` | Jump to the end of the current row. |
| `w` | Jump to the start of the next "word" (a run of floor tiles). |
| `b` | Jump to the start of the previous word. |
| `e` | Jump to the end of the current/next word. |
| `gg` | Jump straight to the top of the current vertical shaft. |
| `G` | Jump straight to the bottom of the current vertical shaft. |
| `dd` | Clear rubble (`O`) on the tile you're standing on. |
| `yy` | Pick up a key item (`K`) on the tile you're standing on. |
| `p` | Place a held key into an adjacent door (`D`), opening it. |
| `<space>ff` | Open the file finder. Type to fuzzy-filter, `Enter` to warp straight to the top match, `Esc` to cancel. |
| `1`-`9` before a motion | Repeats that motion N times, e.g. `3l` moves right 3 tiles, `2j` moves down 2. (Stretch goal - implemented for `h j k l w b e`.) |

### The core mechanic: hazards vs. jumps

Hazard tiles (`X`) send you back to the level's start if you step onto one
*a tile at a time* via `h`/`j`/`k`/`l`. Every "jump" motion (`0` `$` `gg`
`G` `w` `b` `e`) moves straight to its destination without occupying the
tiles in between, so jumps sail over hazards safely. This is a deliberate,
game-ified reading of what's actually true in Vim: `hjkl` walk the cursor
one cell at a time, while the others are absolute or word-relative jumps
that don't "pass through" every intervening cell. It's also what makes
`0`/`$`/`gg`/`G`/`w`/`b`/`e` *useful* rather than merely different from
`hjkl` in this game - a design choice, see below.

Pits (`~`) are the word-motion equivalent: impassable to `h`/`j`/`k`/`l`,
but `w`/`b`/`e` hop clean over them because word boundaries are computed
independently of what physically sits between two words - just like Vim
skips over punctuation/whitespace when word-jumping.

`<space>ff` is a different kind of motion from all of the above: every
other command is a *local* jump, scoped to the current row, column, or
word. The finder is an absolute jump to a named destination anywhere in
the level, bypassing walls, hazards, and pits entirely - modeling how a
fuzzy file-finder (Telescope, fzf) skips the "navigate there" step of
using a file, rather than being a longer-range version of the other jumps.
That also means it's never gated by anything else in a level - see level
13 below, which exists specifically to make that plain.

Levels that use the finder scatter a few decoy files around as visible,
walkable tiles, each with its own icon - the same icon then shows up next
to its name in the finder's own list, the way a real fuzzy-finder shows
file-type icons next to results. Walking past a decoy tells you what its
icon means; the actual goal is always sealed away where you can't walk to
it, so the one icon in the list you never saw out in the world is the one
worth typing toward.

### Permanent upgrades and backtracking

From level 11 onward, two permanent upgrades change what your *existing*
commands can do, metroidvania-style - neither adds a new key to learn:

- **Far Jump** lets every jump motion (`0` `$` `gg` `G` `w` `b` `e`) cross
  a chasm (`C`) the same way it's always crossed a pit - `h`/`j`/`k`/`l`
  still can't. Before the ability, a chasm is a hard wall to everything.
- **Phase** lets `h`/`j`/`k`/`l` themselves pass straight through a phase
  wall (`P`) - the one upgrade that changes *walking*, not just jumping.
  Before Phase, a phase wall is exactly as solid as a real one.

Both persist for the rest of the game once granted, including when you go
back to an earlier level - completed levels aren't locked behind you.
Picking **any** previously-reached level from the title screen (not just
"Continue") reopens it with every command and ability you've earned since,
not just whatever that level originally taught. Level 10, "Deeper In," has
two side chambers sealed by a chasm and a phase wall that are genuinely
impossible to reach the first time through - nothing points you back to it
explicitly beyond the level's own hint remembering itself out loud, the
same way a real metroidvania trusts you to remember a locked door.

## Levels

17 levels. The first 9 teach one command family at a time (mixing
previously-learned commands together from level 7 on); levels 10-17 layer
in the two permanent upgrades above at bigger scale:

1. **First Steps** - `h j k l`. A snaking corridor; pure basic movement.
2. **Line Endings** - `0 $`. A hazard-laced row; `0`/`$` jump clear over
   the hazards that block a step-by-step walk.
3. **Word Hops** - `w b e`. Floor "words" separated by pits; only word
   motions can cross.
4. **Top and Bottom** - `gg G`. A vertical hazard shaft; `G` drops straight
   to the bottom, `gg` jumps straight to the top of a second shaft.
5. **Clear the Rubble** - `dd`. The goal is buried under rubble; clearing
   it (while standing on it) wins the level.
6. **Fetch and Place** - `yy p`. Pick up a key, walk it to a door, place it
   to open the way through.
7. **Combined Trial** - review: word hops, a hazard row, then rubble.
8. **The Gauntlet** - review: a hazard shaft, then a key-and-door puzzle.
9. **Find Files** - `<space>ff`. The goal sits in a vault sealed on every
   side, with no door - the only way in is warping to it by name. A few
   similarly-named decoy files are scattered around, so typing just enough
   of the real name to disambiguate is the actual puzzle.
10. **Deeper In** - no new commands, just a bigger lap of everything so
    far, plus two dormant, sealed side-shafts that don't look crossable
    yet. They aren't - not until levels 11 and 14. Remember this one.
11. **Far Jump** - grants the ability. A normal-skills level; nothing here
    needs a chasm crossed, since the level that grants an upgrade can't
    also require it.
12. **The Chasm** - requires Far Jump. Wide chasm bands stand in for the
    pits from level 3, now crossable the same way once you have the
    ability.
13. **Cross-Reference** - no obstacles at all, deliberately: `<space>ff`
    doesn't care what's between you and a file, so it never needed a
    gauntlet in front of it to prove that. Walk past the two decoys first
    if you want their icons to mean something, then warp into the vault
    from wherever you happen to be standing.
14. **Phase** - grants the ability. Same shape as level 11: play it
    straight, nothing here requires Phase yet.
15. **Through the Wall** - requires Phase. Every connecting doorway in
    this level is a phase wall, not open floor - before the ability, there
    is no route through at all, not even a jump could help.
16. **Compound Interest** - both upgrades in the same level, in whatever
    order you reach them. Neither substitutes for the other.
17. **The Grid** - the finale: everything at once, bigger, plus the
    count-prefix tip (`3l`, `2j`, ...) as a closing bonus. A nudge, too,
    if you still remember level 10's two dormant shafts.

## Project structure

```
index.html
src/
  main.ts              - title screen, app shell, wiring
  style.css            - all styling (dark, monospace, terminal-ish)
  game/
    types.ts           - tile vocabulary, level/command/ability types
    levels.ts           - the 17 level definitions (ASCII grids + hints)
    engine.ts           - movement/motion/action logic, ability-gated passability, win detection
    input.ts            - keystroke -> command parsing (counts, gg/dd/yy chords, <space>ff)
    fuzzy.ts             - subsequence fuzzy matching for the file finder
    render.ts           - renders grid state to the DOM
    commands.ts          - command/ability metadata used by the HUD legend
    storage.ts           - localStorage progress persistence
    controller.ts        - glues engine+input+render+storage into a playable level, plus the finder overlay
scripts/
  playtest.mjs          - headless end-to-end playtest of all 17 levels
  playtest-edge.mjs      - headless check of locked commands, save/continue, the finder, and backtracking
```

## Design decisions worth a second opinion

- **`dd`/`yy`/`p` semantics are simplified, not literal.** Real Vim's `dd`
  deletes a whole *line* and `yy`/`p` yank/paste a whole *line*. Mapping
  that literally to an ASCII platformer didn't produce a clean puzzle, so
  `dd` here clears rubble on the player's current tile, and `yy`/`p` pick
  up/place a single item. This favors game-feel over strict fidelity -
  worth a look if "faithfulness to Vim semantics" matters more than
  "clear puzzle mechanic" for the pedagogical goal.
- **The hazard/jump mechanic (jumps bypass hazards, steps don't) is an
  invented framing**, not something from Vim itself - it's what makes the
  jump commands mechanically necessary rather than just "another way to
  move." If you'd rather commands be optional shortcuts (closer to how
  people actually use Vim - jumps as convenience, not requirement), most
  levels from here on (2-4, 7-8, and nearly all of 10-17) would need
  reworking - the same framing extends to chasms and Far Jump.
- **No arrow-key fallback and no on-screen buttons.** Intentional, per the
  brief, but it does mean the game is unplayable without a physical
  keyboard - no mobile/touch support.
- **Command scope has grown well beyond the original v1 MVP** (`hjkl`,
  `w/b/e`, `0/$`, `gg/G`, `dd`, `yy/p`, plus a count-prefix bonus) -
  `<space>ff` (modeling a fuzzy file-finder, not real Vim's own `/`
  search), and two permanent abilities (Far Jump, Phase) that change what
  existing motions do rather than adding keys. Still nothing here covers
  visual mode, real `/` search, registers, macros, or insert mode.
- **`<space>` as the leader key is a hardcoded convention, not a Vim
  default.** Real Vim's leader is whatever a user's own config maps it to
  (comma, backslash, ...) - space is just the common convention in most
  modern starter configs (LazyVim, kickstart.nvim). Same
  honest-simplification spirit as the `dd`/`yy`/`p` note above.
- **The metroidvania backtracking is fairly shallow by design.** Only one
  level (10) has content gated behind a later ability, with two secrets
  and no other payoff (no item/collectible tracking, no alternate ending).
  A deeper version would gate real shortcuts or bonus levels behind
  specific ability combinations, not just flavor secrets - a reasonable
  "tier 3" if this direction gets pushed further.
- **No sound, animation, or particle-effect polish** - level-complete
  feedback is a text overlay. The brief explicitly allows this for v1, but
  it's the first place I'd invest more time if visual/audio polish is
  wanted.

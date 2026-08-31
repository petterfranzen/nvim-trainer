# VIM QUEST

An ASCII, browser-based platformer that teaches real Vim motions. You move
and act on an `@` character across text-mode levels using actual Vim
keybindings - not arrow keys, not WASD-with-vim-labels. Each level unlocks
one new command family, gives you a one-line in-level hint, and then
requires you to use that command to solve the level.

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
npm run playtest       # headless Playwright run through all 8 levels
npm run playtest:edge  # headless check of locked-command feedback & save/continue
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

## Levels

8 levels, each teaching one command family and then (from level 7) mixing
previously-learned commands together:

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
8. **Final Gauntlet** - review: a hazard shaft, then a key-and-door puzzle,
   plus a tip about count-prefixes (`3l`, `2j`, ...) as a closing bonus.

## Project structure

```
index.html
src/
  main.ts              - title screen, app shell, wiring
  style.css            - all styling (dark, monospace, terminal-ish)
  game/
    types.ts           - tile vocabulary, level/command types
    levels.ts           - the 8 level definitions (ASCII grids + hints)
    engine.ts           - movement/motion/action logic, win detection
    input.ts            - keystroke -> command parsing (counts, gg/dd/yy chords)
    render.ts           - renders grid state to the DOM
    commands.ts          - command metadata used by the HUD legend
    storage.ts           - localStorage progress persistence
    controller.ts        - glues engine+input+render+storage into a playable level
scripts/
  playtest.mjs          - headless end-to-end playtest of all 8 levels
  playtest-edge.mjs      - headless check of locked commands & save/continue
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
  people actually use Vim - jumps as convenience, not requirement), levels
  2-4, 7, and 8 would need reworking.
- **No arrow-key fallback and no on-screen buttons.** Intentional, per the
  brief, but it does mean the game is unplayable without a physical
  keyboard - no mobile/touch support.
- **Command scope stops at the first tier** (`hjkl`, `w/b/e`, `0/$`,
  `gg/G`, `dd`, `yy/p`, plus a count-prefix bonus). Nothing here covers
  visual mode, search (`/`), registers, macros, or insert mode. Deliberately
  out of scope for a v1 MVP; whether to build a "tier 2" is a product call.
- **No sound, animation, or particle-effect polish** - level-complete
  feedback is a text overlay. The brief explicitly allows this for v1, but
  it's the first place I'd invest more time if visual/audio polish is
  wanted.

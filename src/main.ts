import './style.css';
import { GameController, getInitialLevel, TOTAL_LEVELS } from './game/controller.ts';
import { getProgress, resetProgress } from './game/storage.ts';
import { LEVELS } from './game/levels.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
let controller: GameController | null = null;

function showTitle() {
  if (controller) {
    controller.destroy();
    controller = null;
  }
  const progress = getProgress();
  const hasProgress = progress.completed.length > 0;

  // Every level from 0 up to highestUnlocked (inclusive) is replayable,
  // not just the furthest one - this is what actually makes the
  // metroidvania abilities matter: an earlier level's secret, sealed
  // behind a chasm/phase-wall you didn't have the first time through,
  // is only reachable by picking it again from here once you do (see
  // GameController.recomputeUnlocked, which computes unlocked
  // commands/abilities from this same highestUnlocked ceiling rather
  // than "whichever level happens to be loaded").
  const levelButtons = hasProgress
    ? Array.from({ length: progress.highestUnlocked + 1 }, (_, i) => {
        const done = progress.completed.includes(i);
        return `<button class="btn level-btn${done ? ' done' : ''}" data-level="${i}">
          ${done ? '&#10003;' : ''} ${i + 1}. ${LEVELS[i].title}
        </button>`;
      }).join('')
    : '';

  app.innerHTML = `
    <div class="title-screen">
      <pre class="ascii-art">:wq  h j k l  0 \$  gg G  dd  yy p  <space>ff</pre>
      <h1>VIM QUEST</h1>
      <p class="subtitle">Learn real Vim motions by escaping an ASCII dungeon.</p>
      ${
        hasProgress
          ? `<div class="level-select">${levelButtons}</div>
             <button class="btn secondary" id="restart-btn">Start Over</button>`
          : `<div><button class="btn" id="start-btn">Start Game</button></div>`
      }
      <p class="title-progress">${hasProgress ? `Progress: ${progress.completed.length}/${TOTAL_LEVELS} levels complete` : `${TOTAL_LEVELS} levels - no keyboard shortcuts skipped, only the real thing.`}</p>
      <div class="command-preview">
        Move with <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd> - not the arrow keys.
        New commands unlock one level at a time: word jumps (<kbd>w</kbd> <kbd>b</kbd> <kbd>e</kbd>),
        line jumps (<kbd>0</kbd> <kbd>$</kbd>), file jumps (<kbd>gg</kbd> <kbd>G</kbd>),
        two actions (<kbd>dd</kbd>, <kbd>yy</kbd>/<kbd>p</kbd>), and a fuzzy file finder
        (<kbd>&lt;space&gt;ff</kbd>). Further in, permanent upgrades change what those
        same commands can do - once earned, revisit any earlier level to reach what
        was out of range the first time.
      </div>
    </div>
  `;

  app.querySelector('#start-btn')?.addEventListener('click', () => {
    startGame(getInitialLevel());
  });
  app.querySelector('#restart-btn')?.addEventListener('click', () => {
    resetProgress();
    startGame(0);
  });
  app.querySelectorAll<HTMLButtonElement>('.level-btn').forEach((btn) => {
    btn.addEventListener('click', () => startGame(Number(btn.dataset.level)));
  });
}

function startGame(levelIndex: number) {
  app.innerHTML = `
    <div class="game-screen">
      <div id="game-root"></div>
      <footer class="hint-footer">Esc-less by design: this is a game, not your editor. Have fun.</footer>
    </div>
  `;
  const gameRoot = app.querySelector<HTMLDivElement>('#game-root')!;
  controller = new GameController(gameRoot);
  controller.onGameComplete = () => showTitle();
  controller.start(levelIndex);
}

showTitle();

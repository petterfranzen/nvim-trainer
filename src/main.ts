import './style.css';
import { GameController, getInitialLevel, TOTAL_LEVELS } from './game/controller.ts';
import { getProgress, resetProgress } from './game/storage.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
let controller: GameController | null = null;

function showTitle() {
  if (controller) {
    controller.destroy();
    controller = null;
  }
  const progress = getProgress();
  const hasProgress = progress.completed.length > 0;

  app.innerHTML = `
    <div class="title-screen">
      <pre class="ascii-art">:wq  h j k l  0 \$  gg G  dd  yy p</pre>
      <h1>VIM QUEST</h1>
      <p class="subtitle">Learn real Vim motions by escaping an ASCII dungeon.</p>
      <div>
        <button class="btn" id="start-btn">${hasProgress ? 'Continue' : 'Start Game'}</button>
        ${hasProgress ? '<button class="btn secondary" id="restart-btn">Start Over</button>' : ''}
      </div>
      <p class="title-progress">${hasProgress ? `Progress: ${progress.completed.length}/${TOTAL_LEVELS} levels complete` : `${TOTAL_LEVELS} levels - no keyboard shortcuts skipped, only the real thing.`}</p>
      <div class="command-preview">
        Move with <kbd>h</kbd> <kbd>j</kbd> <kbd>k</kbd> <kbd>l</kbd> - not the arrow keys.
        New commands unlock one level at a time: word jumps (<kbd>w</kbd> <kbd>b</kbd> <kbd>e</kbd>),
        line jumps (<kbd>0</kbd> <kbd>$</kbd>), file jumps (<kbd>gg</kbd> <kbd>G</kbd>),
        and two actions (<kbd>dd</kbd>, <kbd>yy</kbd>/<kbd>p</kbd>).
      </div>
    </div>
  `;

  app.querySelector('#start-btn')!.addEventListener('click', () => {
    startGame(getInitialLevel());
  });
  app.querySelector('#restart-btn')?.addEventListener('click', () => {
    resetProgress();
    startGame(0);
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

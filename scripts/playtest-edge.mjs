import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok - ' + msg);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#start-btn');
  await page.waitForSelector('#hud');

  console.log('== Locked command feedback ==');
  await page.keyboard.press('w'); // not unlocked until level 3
  await page.waitForTimeout(50);
  const msg = await page.locator('#message').textContent();
  assert(msg.includes("isn't unlocked"), `pressing a locked command shows a message (got "${msg}")`);
  const moves = await page.locator('.moves').textContent();
  assert(moves.includes('moves: 0'), 'locked command does not move the player');

  console.log('== Mid-game persistence (reload keeps you on the title, not mid-level) ==');
  for (const k of ['8', 'l', '2', 'j', '8', 'h', '2', 'j', '8', 'l', '2', 'j']) {
    await page.keyboard.press(k);
  }
  await page.waitForSelector('.overlay-box');
  await page.keyboard.press('Enter'); // -> level 2
  await page.waitForTimeout(50);
  await page.reload();
  // Reload rebuilds the app fresh at the title screen (v1 has no mid-level
  // resume - only level-complete progress is persisted). Confirm that
  // progress from level 1 nonetheless survived the reload.
  await assert(page.locator('h1:has-text("VIM QUEST")').isVisible(), 'reload lands back on title screen');
  const progressText = await page.locator('.title-progress').textContent();
  assert(progressText.includes('1/17'), `progress after 1 completed level persisted (got "${progressText}")`);
  assert((await page.locator('.level-btn').count()) === 2, 'level-select shows exactly the 2 unlocked levels (1 done, 1 next)');
  await page.click('.level-btn[data-level="1"]'); // pick level 2 directly, not just "Continue"
  await page.waitForSelector('#hud');
  const hudText = await page.locator('#hud .level-name').textContent();
  assert(hudText.includes('Line Endings'), `picking level 2 from the level-select screen opens it (got "${hudText}")`);

  console.log('== <space>ff finder ==');
  // Jump straight to level 9 (index 8) rather than replaying levels 1-8
  // again here - playtest.mjs already covers the happy path of actually
  // unlocking it level by level.
  await page.evaluate(() => {
    localStorage.setItem('nvim-trainer:progress', JSON.stringify({ highestUnlocked: 8, completed: [0, 1, 2, 3, 4, 5, 6, 7] }));
  });
  await page.reload();
  await page.click('.level-btn[data-level="8"]');
  await page.waitForSelector('#hud');
  const level9Hud = await page.locator('#hud .level-name').textContent();
  assert(level9Hud.includes('Find Files'), `picking level 9 from level-select opens it (got "${level9Hud}")`);

  for (const k of [' ', 'f', 'f']) await page.keyboard.press(k);
  await page.waitForTimeout(50);
  assert(await page.locator('.finder-box').isVisible(), 'finder opens on <space>ff');
  assert((await page.locator('.finder-item').count()) === 4, 'finder lists all 4 files with an empty query');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  assert(!(await page.locator('.finder-box').isVisible()), 'Escape closes the finder');
  const movesAfterCancel = await page.locator('.moves').textContent();
  assert(movesAfterCancel.includes('moves: 0'), 'cancelling the finder does not move the player');

  for (const k of [' ', 'f', 'f', 'c', 'o', 'n']) await page.keyboard.press(k);
  await page.waitForTimeout(50);
  assert((await page.locator('.finder-item').count()) === 1, '"con" narrows the list to just config.ts');
  assert((await page.locator('.finder-item').first().textContent()).includes('config.ts'), 'the one remaining match is config.ts');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  assert(!(await page.locator('.finder-box').isVisible()), 'Enter closes the finder after warping');
  assert((await page.locator('.moves').textContent()).includes('moves: 1'), 'warp counts as exactly one move');

  console.log('== Backtracking: abilities persist onto an earlier level ==');
  // Simulate having reached level 17 (index 16) without replaying every
  // level for real - playtest.mjs's full run already covers that. Level
  // 10 ("Deeper In", index 9) has two dormant shafts sealed by a chasm
  // and a phase wall respectively, each hiding a secret unreachable the
  // first time through (see levels.ts) - the actual point of Far Jump
  // and Phase persisting across levels via GameController.recomputeUnlocked
  // rather than resetting to whatever the *current* level alone unlocks.
  await page.evaluate(() => {
    localStorage.setItem('nvim-trainer:progress', JSON.stringify({
      highestUnlocked: 16,
      completed: Array.from({ length: 16 }, (_, i) => i),
    }));
  });
  await page.reload();
  assert((await page.locator('.level-btn').count()) === 17, 'level-select shows all 17 unlocked levels');
  await page.click('.level-btn[data-level="9"]'); // "Deeper In"
  await page.waitForSelector('#hud');
  const level10Hud = await page.locator('#hud .level-name').textContent();
  assert(level10Hud.includes('Deeper In'), `picking level 10 from level-select opens it (got "${level10Hud}")`);
  assert((await page.locator('.badge-ability').count()) === 2, 'both abilities show as HUD badges when revisiting an earlier level');

  // Walk the open top row to the chasm shaft's column and descend.
  for (let i = 0; i < 15; i++) await page.keyboard.press('l');
  await page.keyboard.press('G');
  await page.waitForTimeout(50);
  assert((await page.locator('#message').textContent()).includes('Secret found'), 'Far Jump reaches the chasm-sealed secret on revisit');

  // Back up out of the chasm shaft (gg crosses the same chasm upward,
  // same as G crossed it downward), then over to the phase shaft's
  // column and down again.
  await page.keyboard.press('g'); await page.keyboard.press('g');
  for (let i = 0; i < 3; i++) await page.keyboard.press('l');
  await page.keyboard.press('G');
  await page.waitForTimeout(50);
  assert((await page.locator('#message').textContent()).includes('Secret found'), 'Phase reaches the phase-wall-sealed secret on revisit');

  await browser.close();
  console.log('\nALL EDGE-CASE CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

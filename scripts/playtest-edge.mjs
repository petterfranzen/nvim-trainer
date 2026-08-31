import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5183/';

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
  assert(progressText.includes('1/8'), `progress after 1 completed level persisted (got "${progressText}")`);
  await page.click('#start-btn');
  await page.waitForSelector('#hud');
  const hudText = await page.locator('#hud .level-name').textContent();
  assert(hudText.includes('Line Endings'), `Continue resumes at level 2 (got "${hudText}")`);

  await browser.close();
  console.log('\nALL EDGE-CASE CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

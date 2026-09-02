// Headless Playwright playtest for Vim Quest. Verifies the app is actually
// playable end-to-end: title screen -> all 8 levels -> game complete,
// exercising every command family and the hazard/reset mechanic.
//
// Run with the dev server already up: `npm run dev` in one terminal, then
// `node scripts/playtest.mjs` (optionally BASE_URL=http://localhost:PORT).
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok - ' + msg);
}

async function pressAll(page, keys) {
  for (const k of keys) {
    await page.keyboard.press(k);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log('== Title screen ==');
  await assert(await page.locator('h1:has-text("VIM QUEST")').isVisible(), 'title screen shows VIM QUEST');
  await page.click('#start-btn');
  await page.waitForSelector('#hud');

  const levelSequences = [
    { title: 'First Steps', keys: ['8', 'l', '2', 'j', '8', 'h', '2', 'j', '8', 'l', '2', 'j'] },
    { title: 'Line Endings', keys: ['$', 'j', 'j', '0', 'j', 'j', '$', 'j', 'j', '0'] },
    { title: 'Word Hops', keys: ['w', 'w', 'w', 'e'] },
    { title: 'Top and Bottom', keys: ['G', 'l', 'l', 'l', 'l', 'g', 'g'] },
    { title: 'Clear the Rubble', keys: ['8', 'l', '2', 'j', '8', 'h', '2', 'j', '8', 'l', '2', 'j', 'd', 'd'] },
    { title: 'Fetch and Place', keys: ['l', 'l', 'l', 'y', 'y', 'l', 'l', 'l', 'l', 'l', 'p', 'j', 'j'] },
    { title: 'Combined Trial', keys: ['w', 'w', 'e', 'j', 'j', '0', 'j', 'j', '8', 'l', 'd', 'd'] },
    { title: 'The Gauntlet', keys: ['G', 'h', 'h', 'y', 'y', 'l', 'l', 'p', 'j', 'j'] },
    // <space>ff, then "in" - already an unambiguous fuzzy match for
    // "index.ts" among the level's decoy files (utils.ts/router.ts have
    // no 'n' at all; config.ts's only 'n' comes before its only 'i') -
    // then Enter to warp straight onto the sealed vault's goal.
    { title: 'Find Files', keys: [' ', 'f', 'f', 'i', 'n', 'Enter'] },
    // Levels 10-17: no new keybindings, just chasms ('C', needs Far
    // Jump) and phase walls ('P', needs Phase) alongside everything
    // already known. See levels.ts's own header comment on this batch
    // for the shared corridor shape every one of these follows.
    { title: 'Deeper In', keys: ['j', '$', 'j', 'j', '0', 'j', 'j', 'l', 'l', 'l', 'y', 'y', 'l', 'l', 'l', 'l', 'l', 'p', 'l', 'l', 'l', 'l', 'j', 'j'] },
    { title: 'Far Jump', keys: ['j', '$', 'j', 'j', '0', 'j', 'j', '$', 'j', 'j', 'h', 'h', 'h', 'h', 'y', 'y', 'h', 'h', 'h', 'h', 'h', 'p', 'h', 'h', 'h', 'h', 'h', 'j', 'j'] },
    { title: 'The Chasm', keys: ['j', '$', 'j', 'j', '0', 'j', 'j', '$', 'j', 'j'] },
    // The whole point of this level is that ff needs no walking at all -
    // straight from the start tile to the vault.
    { title: 'Cross-Reference', keys: [' ', 'f', 'f', 'v', 'Enter'] },
    { title: 'Phase', keys: ['j', '$', 'j', 'j', 'h', 'h', 'h', 'y', 'y', 'h', 'h', 'h', 'h', 'h', 'p', 'h', 'h', 'h', 'h', 'h', 'h', 'j', 'j', '$', 'j', 'j'] },
    { title: 'Through the Wall', keys: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'j', 'j', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'j', 'j', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'j', 'j'] },
    { title: 'Compound Interest', keys: ['j', '$', 'j', 'j', '0', 'j', 'j', '$', 'j', 'j', 'h', 'h', 'h', 'y', 'y', 'h', 'h', 'h', 'h', 'h', 'p', 'h', 'h', 'h', 'h', 'h', 'h', 'j', 'j', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'] },
    { title: 'The Grid', keys: ['j', '$', 'j', 'j', '0', 'j', 'j', '$', 'j', 'j', 'h', 'h', 'h', 'h', 'y', 'y', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'p', 'h', 'h', 'h', 'h', 'h', 'j', 'j', ' ', 'f', 'f', 'x', 'Enter'] },
  ];

  for (let i = 0; i < levelSequences.length; i++) {
    const { title, keys } = levelSequences[i];
    console.log(`== Level ${i + 1}: ${title} ==`);
    const hudText = await page.locator('#hud .level-name').textContent();
    assert(hudText.includes(title), `HUD shows "${title}" (got "${hudText}")`);

    if (i === 1) {
      // Extra check: walking into a hazard resets the level.
      await pressAll(page, ['l', 'l']);
      await page.waitForTimeout(50);
      const msg = await page.locator('#message').textContent();
      assert(msg.includes('Zapped'), 'hazard tile zaps the player back to start');
      const moves = await page.locator('.moves').textContent();
      assert(moves.includes('moves: 0'), 'move counter reset after zap');
    }

    await pressAll(page, keys);
    await page.waitForTimeout(50);

    const isLast = i === levelSequences.length - 1;
    await page.waitForSelector('.overlay-box', { timeout: 2000 });
    const overlayText = await page.locator('.overlay-box').textContent();
    if (isLast) {
      assert(overlayText.includes("completed Vim Quest"), 'final overlay shows game-complete message');
    } else {
      assert(overlayText.includes('Level Complete'), `level ${i + 1} shows Level Complete overlay`);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
  }

  console.log('== Back at title screen after finishing ==');
  await assert(await page.locator('h1:has-text("VIM QUEST")').isVisible(), 'returned to title screen');
  const progressText = await page.locator('.title-progress').textContent();
  assert(progressText.includes('17/17'), `localStorage progress shows 17/17 complete (got "${progressText}")`);

  if (consoleErrors.length) {
    console.log('Console errors observed:', consoleErrors);
    throw new Error('Console errors were logged during the playtest');
  }

  await browser.close();
  console.log('\nALL PLAYTEST CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

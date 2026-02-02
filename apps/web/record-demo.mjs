import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const OUTPUT = 'C:/Users/Memes/ClawTrade/clawtrade-demo.webm';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: 'C:/Users/Memes/ClawTrade/demo-videos/', size: { width: 1400, height: 900 } },
  });
  const page = await context.newPage();

  // 1. Boot sequence
  console.log('[1/10] Recording boot sequence...');
  await page.goto(BASE);
  // Clear session storage to force boot
  await page.evaluate(() => sessionStorage.removeItem('clawtrade-booted'));
  await page.reload();
  await page.waitForTimeout(4000); // Watch full boot sequence

  // 2. Dashboard with data (demo mode)
  console.log('[2/10] Recording dashboard with mock data...');
  await page.goto(`${BASE}?demo=true`);
  await page.waitForTimeout(3000); // Let mock data load and settle

  // 3. Hover over the README section
  console.log('[3/10] Reading the README...');
  await page.mouse.move(250, 300);
  await page.waitForTimeout(1500);
  // Slowly scroll the README
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, 150);
  await page.waitForTimeout(1500);

  // 4. Hover over agent characters in the Agent World
  console.log('[4/10] Exploring Agent World...');
  // Move to the right side where agent world is
  await page.mouse.move(1150, 300);
  await page.waitForTimeout(1000);
  await page.mouse.move(1150, 400);
  await page.waitForTimeout(800);
  await page.mouse.move(1250, 300);
  await page.waitForTimeout(800);

  // 5. Click through leaderboard tabs
  console.log('[5/10] Clicking leaderboard tabs...');
  await page.click('text=VOLUME');
  await page.waitForTimeout(2000);
  await page.click('text=WIN RATE');
  await page.waitForTimeout(2000);
  await page.click('text=PROFIT');
  await page.waitForTimeout(2000);

  // 6. Scroll through the feed
  console.log('[6/10] Scrolling through feed...');
  await page.mouse.move(250, 600);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(1500);

  // 7. Navigate to leaderboard page
  console.log('[7/10] Navigating to full leaderboard...');
  const leaderboardBtn = page.locator('a:has-text("#1 Leaderboard")').first();
  if (await leaderboardBtn.isVisible()) {
    await leaderboardBtn.click();
  } else {
    await page.goto(`${BASE}/leaderboard`);
  }
  await page.waitForTimeout(3000);

  // 8. Navigate to tokens page
  console.log('[8/10] Navigating to tokens page...');
  const tokensBtn = page.locator('a:has-text("$ Tokens")').first();
  if (await tokensBtn.isVisible()) {
    await tokensBtn.click();
  } else {
    await page.goto(`${BASE}/tokens`);
  }
  await page.waitForTimeout(3000);

  // 9. Navigate to groups page
  console.log('[9/10] Navigating to groups page...');
  const groupsBtn = page.locator('a:has-text("{} Groups")').first();
  if (await groupsBtn.isVisible()) {
    await groupsBtn.click();
  } else {
    await page.goto(`${BASE}/groups`);
  }
  await page.waitForTimeout(2500);

  // 10. Back to desktop - final view
  console.log('[10/10] Back to desktop for final shot...');
  const desktopBtn = page.locator('a:has-text("Desktop")').first();
  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
  } else {
    await page.goto(`${BASE}?demo=true`);
  }
  await page.waitForTimeout(3000);

  // Finish
  console.log('Saving video...');
  await page.close();
  const video = page.video();
  if (video) {
    const path = await video.path();
    console.log(`Video saved to: ${path}`);
    const fs = await import('fs');
    fs.copyFileSync(path, OUTPUT);
    console.log(`Copied to: ${OUTPUT}`);
  }

  await context.close();
  await browser.close();
  console.log('Done!');
}

main().catch(console.error);

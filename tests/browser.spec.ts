import { expect, test, type Page } from '@playwright/test';
import type { MatchState } from '../src/combat/types';
declare global { interface Window { readonly __combat: MatchState | null } }
async function setup(page: Page, training = false): Promise<void> {
  await page.goto('/');
  await page.locator(training ? '.nav-item[data-nav="training"]' : '#quick-match').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (training) await page.locator('#style-select').selectOption('passive');
}
async function start(page: Page, training = false): Promise<void> { await page.getByRole('button', { name: training ? 'Enter training →' : 'Step onto the mat →' }).click(); await expect(page.locator('#match-canvas')).toBeVisible(); }
test('main menu, fighter selection, real keyboard movement, CPU behavior and clean rematch', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page); await page.locator('[data-fighter="2"]').click(); await page.locator('#opponent-select').selectOption('3'); await start(page);
  await expect(page.locator('#player-name')).toHaveText('Eli Brooks'); await expect(page.locator('#opponent-name')).toHaveText('Noor Hassan');
  const x = await page.evaluate(() => window.__combat!.fighters[0].x);
  await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
  const after = await page.evaluate(() => window.__combat!); expect(after.fighters[0].x).toBeGreaterThan(x + 15); expect(after.fighters[1].distanceTravelled).toBeGreaterThan(0);
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'In your corner.' })).toBeVisible();
  const paused = await page.evaluate(() => window.__combat!.time); await page.waitForTimeout(300); expect(await page.evaluate(() => window.__combat!.time)).toBe(paused);
  await page.getByRole('button', { name: 'Back to the mat →' }).click(); await page.keyboard.press('t');
  await expect(page.getByRole('heading', { name: 'A lesson on the mat.' })).toBeVisible(); await expect(page.locator('.save-message')).toContainText('Saved');
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem('combat-legacy-results-v1')!)); expect(results).toHaveLength(1); expect(results[0].result.method).toBe('Tap');
  await page.getByRole('button', { name: 'Run it back →' }).click();
  const restarted = await page.evaluate(() => window.__combat!); expect(restarted.result).toBeNull(); expect(restarted.score).toEqual([0, 0]); expect(restarted.position).toBe('standing'); expect(restarted.fighters[0].attempts).toBe(0); expect(restarted.events[0].id).toBe(1);
  expect(errors).toEqual([]);
});
test('actual standing takedown enters connected guard and legal contextual actions', async ({ page }) => {
  await setup(page, true); await start(page, true);
  await page.keyboard.down('d'); await page.waitForTimeout(1250); await page.keyboard.up('d');
  await expect(page.locator('[data-action="doubleLeg"]')).toBeVisible(); await page.keyboard.press('j');
  await expect(page.locator('#position-label')).toHaveText('Closed guard');
  const s = await page.evaluate(() => window.__combat!); expect(s.top).toBe(0); expect(s.fighters[0].successes).toBe(1); expect(s.fighters[0].stamina).toBeLessThan(100); expect(s.events.some(e => e.position === 'takedownScramble')).toBe(true);
  await expect.poll(() => page.evaluate(() => { const s = window.__combat!; return Math.hypot(s.fighters[0].x - s.fighters[1].x, s.fighters[0].y - s.fighters[1].y); })).toBeLessThan(38);
  await expect(page.locator('[data-action="pass"]')).toBeVisible(); await expect(page.locator('[data-action="sweep"]')).toHaveCount(0);
});
test('ground actions animate, submissions finish interactively, practice is not recorded', async ({ page }) => {
  await setup(page, true); await page.locator('#position-select').selectOption('sideControl'); await start(page, true);
  await page.locator('[data-action="mount"]').click(); await expect(page.locator('#position-label')).toHaveText('Mount');
  await page.waitForTimeout(400);
  await page.locator('[data-action="submit"]').click(); await expect(page.locator('#submission-panel')).toBeVisible();
  const before = await page.evaluate(() => window.__combat!.submission!.progress);
  await page.keyboard.down('j'); await page.keyboard.down('d'); await page.waitForTimeout(1500); expect(await page.evaluate(() => window.__combat!.submission!.progress)).toBeGreaterThan(before);
  await expect(page.getByRole('heading', { name: 'Your hand, raised.' })).toBeVisible({ timeout: 18000 }); await page.keyboard.up('j'); await page.keyboard.up('d');
  expect(await page.evaluate(() => window.__combat!.result!.method)).toBe('Submission'); expect(await page.evaluate(() => localStorage.getItem('combat-legacy-results-v1'))).toBeNull();
});
test('a real 1-minute quick match reaches a valid CPU result and stores the timeline', async ({ page }) => {
  test.setTimeout(80000);
  await setup(page); await page.locator('#duration-select').selectOption('60'); await start(page);
  await expect(page.getByRole('heading', { name: 'A lesson on the mat.' })).toBeVisible({ timeout: 70000 });
  const s = await page.evaluate(() => window.__combat!); expect(s.result?.winner).toBe(1); expect(['Submission', 'Points']).toContain(s.result?.method); expect(s.fighters[1].successes).toBeGreaterThan(0); expect(s.events.some(e => e.kind === 'score' || e.kind === 'submission')).toBe(true);
  await page.getByRole('button', { name: 'Back to menu', exact: true }).click(); await page.locator('.nav-item[data-nav="history"]').click();
  await expect(page.locator('.history-row')).toHaveCount(1); await page.locator('.history-row').click(); await expect(page.locator('.event-ended')).toHaveCount(1);
});
test('rebindings persist, conflicts are rejected, and alternate movement works', async ({ page }) => {
  await page.goto('/'); await page.locator('.nav-item[data-nav="controls"]').click();
  await page.locator('[data-binding="right"]').click(); await page.keyboard.press('p'); await expect(page.locator('[data-binding="right"] kbd')).toHaveText('P');
  await page.locator('[data-binding="left"]').click(); await page.keyboard.press('p'); await expect(page.locator('#binding-message')).toContainText('already assigned');
  await page.reload(); await page.locator('.nav-item[data-nav="controls"]').click(); await expect(page.locator('[data-binding="right"] kbd')).toHaveText('P');
  await page.locator('.nav-item[data-nav="play"]').click(); await page.locator('#quick-match').click(); await start(page);
  const x = await page.evaluate(() => window.__combat!.fighters[0].x); await page.keyboard.down('p'); await page.waitForTimeout(250); await page.keyboard.up('p'); expect(await page.evaluate(() => window.__combat!.fighters[0].x)).toBeGreaterThan(x + 10);
});
test('responsive menu and setup have no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#quick-match').click(); await expect(page.locator('#start-match')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await start(page); await expect(page.locator('#match-canvas')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('mirror fighters stay distinguishable and corrupt or unavailable storage never blocks play', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('combat-legacy-results-v1', JSON.stringify([{ player: 'Bad record', opponent: 'Missing events', result: {} }])); });
  await page.goto('/'); await page.locator('.nav-item[data-nav="history"]').click(); await expect(page.getByRole('heading', { name: 'A clean slate.' })).toBeVisible();
  await page.locator('.nav-item[data-nav="play"]').click(); await page.locator('#quick-match').click(); await page.locator('#opponent-select').selectOption('0'); await start(page);
  expect(await page.evaluate(() => window.__combat!.fighters[0].profile.color)).not.toBe(await page.evaluate(() => window.__combat!.fighters[1].profile.color));
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.keyboard.press('t'); await expect(page.locator('.save-message')).toContainText('could not be saved');
  await page.getByRole('button', { name: 'Inspect event timeline' }).click(); await page.locator('#close-timeline').click(); await expect(page.locator('.save-message')).toContainText('could not be saved');
});

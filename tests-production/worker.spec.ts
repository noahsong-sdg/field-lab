import { test, expect } from '@playwright/test';

test('built app loads its bundled module worker and updates the actual UI', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const workerLoaded = page.waitForEvent('worker');
  await page.goto('/');
  await page.locator('[data-stage="6"]').click();
  const worker = await workerLoaded;
  expect(worker.url()).toMatch(/\/assets\/[^/]+\.js$/);
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'ready');
  await page.locator('#pg-mode').selectOption('current');
  await page.locator('#pg-current-number').fill('710');
  await page.locator('#pg-current-number').press('Tab');
  await expect(page.locator('#pg-main-metrics')).toContainText('710.0 A');
  await expect(page.locator('#playground')).toHaveAttribute('data-compute-state', 'ready');
  await expect(page.locator('#pg-keep')).toBeEnabled();
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';

test('touch navigation, exact input and preserved chapter state', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch-specific test runs in device-emulated projects.');
  await page.goto('/');
  await page.locator('[data-stage="6"]').tap();
  await expect(page.locator('#pg-reset')).toBeVisible();
  await page.locator('#pg-reset').tap();
  await page.locator('#pg-current-number').fill('600');
  await page.locator('#pg-current-number').press('Tab');
  await expect(page.locator('#pg-main-metrics')).toContainText('600.0 A');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#pg-keep').tap();
  await expect(page.locator('#pg-comparison')).toContainText('Kept');
  await page.locator('#pg-reset').tap();
  await expect(page.locator('#pg-current')).toHaveValue('500');
});

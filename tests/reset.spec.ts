import { test, expect } from '@playwright/test';

test('chapter restart clears integrated controls, kept designs and geometry import', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-stage="5"]').click();
  await page.locator('#load-preset').selectOption('1');
  await page.locator('[data-stage="6"]').click();
  await page.locator('#pg-l-number').fill('300');
  await page.locator('#pg-l-number').press('Tab');
  await page.locator('#pg-keep').click();
  await expect(page.locator('#pg-restore')).toBeEnabled();
  await page.locator('#restart').evaluate((el) => {
    const menu = el.closest('details');
    if (menu) menu.open = true;
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#restart').click();
  await expect(page.locator('#progress-label')).toHaveText('0/28 complete');
  await page.locator('[data-stage="5"]').click();
  await expect(page.locator('#load-preset')).toHaveValue('0');
  await expect(page.locator('#load-k')).toHaveValue('0.02');
  await page.locator('[data-stage="6"]').click();
  await expect(page.locator('#pg-restore')).toBeDisabled();
  await expect(page.locator('#pg-l')).toHaveValue('105');
  await expect(page.locator('#pg-mode')).toHaveValue('density');
  await expect(page.locator('#pg-comparison')).not.toContainText('Kept:');
  expect(errors).toEqual([]);
});

import { test, expect } from '@playwright/test';

test('all citation guides and focus links work without distributed scans', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#book-reference')).toContainText('no book scans');
  await expect(page.locator('#book-reference img')).toHaveCount(0);
  for (let p = 20; p <= 40; p++) {
    await page.locator('#book-page').selectOption(String(p));
    expect((await page.locator('#book-guide').innerText()).length).toBeGreaterThan(20);
  }
  await page.locator('#page-ref').click();
  await expect(page.locator('#book-heading')).toBeFocused();
  await page.locator('#book-return').click();
  await expect(page.locator('#lesson-heading')).toBeFocused();
});

test('keyboard navigation and denied storage remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Denied', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to experiment' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lesson-heading')).toBeFocused();
  await page.locator('#free').click();
  await expect(page.locator('#parameter')).toBeEnabled();
  await expect(page.locator('#storage-status')).toContainText('cannot be saved');
});

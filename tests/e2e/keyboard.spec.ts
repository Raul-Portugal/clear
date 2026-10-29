import { test, expect } from './fixtures';

test.describe('keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('n, j, x, ctrl+z, ? and palette', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.keyboard.press('n');
    await expect(page.getByRole('textbox', { name: 'Add a task' })).toBeFocused();
    await page.keyboard.type('Write report');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText(/Added/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    await expect(page.getByRole('button', { name: 'Write report' })).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Write report' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('upcoming');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
  });
});

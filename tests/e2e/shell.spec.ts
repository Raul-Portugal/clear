import { test, expect } from './fixtures';

test('shell renders with navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Now' })).toBeVisible();
  await page.getByRole('button', { name: 'Waiting' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting' })).toBeVisible();
});

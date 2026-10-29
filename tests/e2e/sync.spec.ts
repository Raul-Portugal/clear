import { test, expect } from './fixtures';

test('sync UI is absent when Supabase is not configured', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'View options' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Sync', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Send sign-in link')).toHaveCount(0);
});

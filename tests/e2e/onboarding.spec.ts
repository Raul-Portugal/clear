import { test, expect } from '@playwright/test';

test('first run shows welcome tasks once', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Swipe right to complete me/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /Complete Swipe right/ }).click();
  await expect(page.getByRole('status')).toHaveText(/Completed/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Swipe left to delete me/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Swipe right to complete me/ })).toHaveCount(0);
});

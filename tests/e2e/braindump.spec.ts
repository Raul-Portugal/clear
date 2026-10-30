import { test, expect } from './fixtures';

async function dump(page: import('@playwright/test').Page, text: string) {
  await page.getByRole('button', { name: 'Brain dump' }).click();
  await page.getByRole('textbox', { name: 'Brain dump' }).fill(text);
}

test('brain dump is one tap from the main screen and saves to the Inbox without organizing', async ({ page }) => {
  await page.goto('/');
  await dump(page, 'Call the dentist\nEmail Ana about the budget');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(/Saved to Inbox/);
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.getByText('Call the dentist')).toBeVisible();
  // survives a reload; nothing was turned into tasks
  await page.reload();
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.getByText('Call the dentist')).toBeVisible();
  await page.getByRole('button', { name: /^Now/ }).click();
  await expect(page.getByRole('button', { name: /Call the dentist/ })).toHaveCount(0);
});

test('several dumps can wait, and each can be organized later', async ({ page }) => {
  await page.goto('/');
  await dump(page, '- Buy milk\n- Call mum');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await dump(page, 'Renew passport');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.locator('[data-dump-id]')).toHaveCount(2);

  await page.locator('[data-dump-id]', { hasText: 'Buy milk' }).getByRole('button', { name: 'Organize' }).click();
  await expect(page.getByText('2 tasks found')).toBeVisible();
  await page.getByRole('button', { name: 'Add 2 tasks' }).click();
  await expect(page.getByRole('status')).toHaveText(/2 tasks added/);
  await expect(page.locator('[data-dump-id]')).toHaveCount(1);
  await page.getByRole('button', { name: /^Now/ }).click();
  await expect(page.getByRole('button', { name: /Buy milk/ })).toBeVisible();
});

test('organize now from the editor creates tasks and clears the dump', async ({ page }) => {
  await page.goto('/');
  await dump(page, 'Book flights');
  await page.getByRole('button', { name: 'Organize now' }).click();
  await page.getByRole('button', { name: 'Add 1 task' }).click();
  await expect(page.getByRole('status')).toHaveText(/1 tasks added/);
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.locator('[data-dump-id]')).toHaveCount(0);
});

test('an empty dump leaves nothing behind', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain dump' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.locator('[data-dump-id]')).toHaveCount(0);
});

test('closing with Escape keeps the typed text', async ({ page }) => {
  await page.goto('/');
  await dump(page, 'Remember the thing');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.getByText('Remember the thing')).toBeVisible();
});

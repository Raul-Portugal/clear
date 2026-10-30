import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function addTask(page: Page, title: string) {
  const fab = page.getByRole('button', { name: 'Add task' });
  if (await fab.isVisible()) await fab.click();
  await page.getByRole('textbox', { name: 'Add a task' }).fill(title);
  await page.keyboard.press('Enter');
}

test('add → complete → undo, and survives reload', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Buy milk');
  const row = page.getByRole('button', { name: 'Buy milk' });
  await expect(row).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Buy milk' })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Complete Buy milk' }).click();
  await expect(page.getByRole('button', { name: 'Buy milk' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Buy milk' })).toBeVisible();
});

test('subtasks via detail', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Plan trip');
  await expect(page.getByRole('status')).toHaveText(/Added/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Plan trip' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const add = dialog.getByLabel('Add subtask');
  await add.fill('Book flights');
  await add.press('Enter');
  await add.fill('Pack bags');
  await add.press('Enter');
  await expect(dialog.getByLabel('Subtask Book flights')).toBeVisible();
  await expect(dialog.getByLabel('Subtask Pack bags')).toBeVisible();

  // inline edit: Enter saves
  const first = dialog.getByLabel('Subtask Book flights');
  await first.fill('Book train');
  await first.press('Enter');
  await expect(dialog.getByLabel('Subtask Book train')).toBeVisible();

  // complete one via its checkbox
  await dialog.getByRole('checkbox', { name: 'Complete Pack bags' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Complete Pack bags' })).toHaveAttribute('aria-checked', 'true');

  // delete the other via its Delete button (visible on hover/focus)
  await dialog.getByLabel('Subtask Book train').hover();
  await dialog.getByRole('button', { name: 'Delete Book train' }).click({ force: true });
  await expect(dialog.getByLabel('Subtask Book train')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-task-id]').getByText('1/1')).toBeVisible();
});

test('smart syntax creates tag and high urgency', async ({ page }) => {
  await page.goto('/');
  const fab = page.getByRole('button', { name: 'Add task' });
  if (await fab.isVisible()) await fab.click();
  await page.getByRole('textbox', { name: 'Add a task' }).fill('Call dentist tomorrow 10am !high #health ~quick');
  await expect(page.getByRole('button', { name: '#health' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(/Added/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Call dentist/ })).toContainText('Tomorrow 10:00');
  await expect(page.getByRole('img', { name: 'High urgency' })).toBeVisible();
});

test('a task with subtasks: first click shows them, second opens details', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Plan party');
  await expect(page.getByRole('status')).toHaveText(/Added/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Plan party' }).click();
  const dialog = page.getByRole('dialog');
  const add = dialog.getByLabel('Add subtask');
  await add.fill('Send invites fri !high');
  await add.press('Enter');
  // smart syntax categorized the subtask
  await expect(dialog.getByRole('img', { name: 'High urgency' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  const row = page.getByRole('button', { name: /Plan party/ });
  await row.click();
  await expect(page.getByRole('list', { name: 'Subtasks of Plan party' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await row.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('list', { name: 'Subtasks of Plan party' })).toHaveCount(0);

  // categorize an existing subtask through its options
  await dialog.getByRole('button', { name: 'Options for Send invites' }).click();
  await dialog.getByRole('radiogroup', { name: 'Effort of Send invites' }).getByRole('radio', { name: 'Deep' }).click();
  await dialog.getByRole('button', { name: 'Options for Send invites' }).click();
  await expect(dialog.getByRole('img', { name: 'Deep effort' })).toBeVisible();
});

test('mobile quick add opens in place atop the list and closes when left empty', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the FAB is mobile-only');
  await page.goto('/');
  await page.getByRole('button', { name: 'Add task' }).click();
  const input = page.getByRole('textbox', { name: 'Add a task' });
  await expect(input).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0); // no sheet
  await input.fill('Inline one');
  await input.press('Enter');
  await expect(page.getByText('Inline one', { exact: true })).toBeVisible();
  await expect(input).toBeFocused(); // ready for the next one
  const box = (await input.boundingBox())!;
  const first = (await page.locator('[data-task-id]').first().boundingBox())!;
  expect(box.y).toBeLessThan(first.y); // the field sits above the list, not at the bottom
  await page.locator('h1').click();
  await expect(input).toHaveCount(0);
});

test('tags in detail: space, Enter and leaving the field all add the typed tag', async ({ page }) => {
  await page.goto('/');
  await addTask(page, 'Water plants');
  await expect(page.getByRole('status')).toHaveText(/Added/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Water plants' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByRole('button', { name: 'Add tag' }).click();
  const input = dialog.getByLabel('New tag');
  await expect(input).toHaveAttribute('enterkeyhint', 'done');
  await input.pressSequentially('home ');
  await expect(input).toHaveValue('');
  await input.fill('garden');
  await input.press('Enter');
  // Android's "Next" key moves focus without sending Enter: the typed tag must still land.
  await input.fill('weekly');
  await dialog.getByLabel('Add subtask').focus();

  for (const name of ['home', 'garden', 'weekly']) await expect(dialog.getByText(`#${name}`, { exact: true })).toBeVisible();
  // An existing tag offered as a suggestion can be tapped while the field is open.
  await dialog.getByRole('button', { name: 'Remove' }).last().click(); // removes #weekly, the last one added
  await dialog.getByRole('button', { name: 'Add tag' }).click();
  await dialog.getByRole('button', { name: '#weekly', pressed: false }).click();
  await expect(dialog.getByRole('button', { name: '#weekly', pressed: true })).toBeVisible();
});

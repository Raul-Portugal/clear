import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function seed(page: Page, titles: string[]) {
  await page.goto('/');
  const fab = page.getByRole('button', { name: 'Add task' });
  if (await fab.isVisible()) await fab.click();
  const input = page.getByRole('textbox', { name: 'Add a task' });
  for (const t of titles) {
    await input.fill(t);
    await input.press('Enter');
    await expect(row(page, t)).toBeVisible();
  }
  await page.keyboard.press('Escape');
}

const row = (page: Page, title: string) =>
  page.locator('[data-task-id]').filter({ has: page.getByText(title, { exact: true }) });
const titles = (page: Page) => page.locator('[data-task-id] [data-testid="task-title"]').allInnerTexts();

test('swipe left deletes, undo restores', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Playwright cannot synthesize a touch swipe; covered on desktop with the mouse');
  await seed(page, ['Alpha', 'Beta']);
  const beta = row(page, 'Beta');
  const box = (await beta.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width - 20 - i * 25, y);
  await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText(/Task deleted/);
  await expect(row(page, 'Beta')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'Beta')).toBeVisible();
});

test('drag a task to reorder switches to manual sort', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the hover grip is mouse-only; touch uses long-press');
  await seed(page, ['One', 'Two', 'Three']);
  const last = row(page, 'Three');
  const first = row(page, 'One');
  await last.hover();
  const grip = last.locator('button[aria-hidden]').first();
  const from = (await grip.boundingBox())!;
  const to = (await first.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - (i * (from.y - to.y + 10)) / 12);
  }
  await page.mouse.up();
  await expect(page.getByRole('status')).toHaveText(/sorted manually/);
  await expect.poll(() => titles(page)).toEqual(['Three', 'One', 'Two']);
});

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
/** After a drop every row sits in its own slot: tops follow DOM order and no two rows overlap. */
async function expectSettled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = [...document.querySelectorAll('[data-task-id]')].map((e) => e.getBoundingClientRect());
        return r.every((b, i) => i === 0 || b.top >= r[i - 1].bottom - 1);
      }),
    )
    .toBe(true);
}

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

test('long-press and drag a task on touch reorders it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await seed(page, ['One', 'Two', 'Three']);
  await expect(page.getByRole('textbox', { name: 'Add a task' })).toBeHidden(); // sheet and scrim gone
  const from = (await row(page, 'Three').boundingBox())!;
  const to = (await row(page, 'One').boundingBox())!;
  const x = from.x + from.width / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x, y }] });
  const y0 = from.y + from.height / 2;
  await touch('touchStart', y0);
  await page.waitForTimeout(600); // hold to lift
  const y1 = to.y + 4;
  for (let i = 1; i <= 15; i++) {
    await touch('touchMove', y0 + ((y1 - y0) * i) / 15);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd');
  await expect(page.getByRole('status')).toHaveText(/sorted manually/);
  await expect.poll(() => titles(page)).toEqual(['Three', 'One', 'Two']);
  await expectSettled(page);
  await expect(page.getByRole('dialog')).toHaveCount(0); // a moved hold does not open the details
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
  await expectSettled(page);
});

test('drag a subtask to reorder it in the detail sheet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the hover grip is mouse-only; touch uses long-press');
  await seed(page, ['Parent']);
  await row(page, 'Parent').getByTestId('task-title').click();
  const add = page.getByRole('textbox', { name: 'Add subtask' });
  for (const t of ['Sub A', 'Sub B', 'Sub C']) {
    await add.fill(t);
    await add.press('Enter');
    await expect(page.getByRole('textbox', { name: `Subtask ${t}` })).toBeVisible();
  }
  const subTitles = () =>
    page.getByRole('list').filter({ has: page.getByRole('textbox', { name: 'Subtask Sub A' }) }).getByRole('textbox').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  const c = page.locator('li').filter({ has: page.getByRole('textbox', { name: 'Subtask Sub C' }) });
  const a = page.locator('li').filter({ has: page.getByRole('textbox', { name: 'Subtask Sub A' }) });
  await c.hover();
  const grip = (await c.locator('button[aria-hidden]').boundingBox())!;
  const top = (await a.boundingBox())!;
  const x = grip.x + grip.width / 2;
  const y0 = grip.y + grip.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x, y0 - (i * (y0 - top.y + 4)) / 12);
  await page.mouse.up();
  await expect.poll(subTitles).toEqual(['Sub C', 'Sub A', 'Sub B']);
});

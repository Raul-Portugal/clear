import { test, expect } from './fixtures';

test.describe('drag reorder smoothness', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse drag, desktop only');

  test('the dragged row tracks the pointer and rows swap once each', async ({ page }) => {
    await page.goto('/');
    for (const t of ['One !high', 'Two tomorrow #home', 'Three', 'Four #work ~deep']) {
      await page.getByRole('textbox', { name: 'Add a task' }).fill(t);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText(/Added/);
      await page.waitForTimeout(150);
    }
    const row = page.locator('[data-task-id]').filter({ has: page.getByText('One', { exact: true }) });
    await row.hover();
    const g = (await row.locator('button[aria-hidden]').boundingBox())!;
    const x = g.x + g.width / 2;
    const y0 = g.y + g.height / 2;

    // sample every frame in the page: dragged row top, and the visible order of rows
    await page.evaluate(() => {
      const w = window as unknown as { __s: { top: number; order: string; down: boolean; t: number }[]; __down: boolean };
      w.__s = [];
      w.__down = false;
      const el = [...document.querySelectorAll('[data-task-id]')].find((e) => e.textContent?.includes('One'))!;
      const tick = () => {
        const order = [...document.querySelectorAll('[data-task-id]')]
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
          .map((e) => (e.querySelector('[data-testid=task-title]') as HTMLElement).textContent)
          .join(',');
        w.__s.push({ top: el.getBoundingClientRect().top, order, down: w.__down, t: performance.now() });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.mouse.move(x, y0);
    await page.mouse.down();
    await page.evaluate(() => ((window as unknown as { __down: boolean }).__down = true));
    for (let i = 1; i <= 80; i++) {
      await page.mouse.move(x, y0 + i * 3);
      await page.waitForTimeout(8);
    }
    await page.evaluate(() => ((window as unknown as { __down: boolean }).__down = false));
    await page.mouse.up();
    await page.waitForTimeout(400);

    const all = await page.evaluate(() => (window as unknown as { __s: { top: number; order: string; down: boolean; t: number }[] }).__s);
    const s = all.filter((p) => p.down); // while held; the release settle animation is expected
    const jumps = s.slice(1).map((p, i) => Math.abs(p.top - s[i].top));
    const flips = s.slice(1).filter((p, i) => p.order !== s[i].order).length;
    const dts = s.slice(1).map((p, i) => p.t - s[i].t);
    console.log('max frame time ms', Math.max(...dts).toFixed(0));
    console.log('max frame jump', Math.max(...jumps).toFixed(1), 'order changes', flips);
    expect(Math.max(...jumps)).toBeLessThan(25);
    expect(flips).toBeLessThanOrEqual(4);
  });
});

import { test as base, expect } from '@playwright/test';

/** Skips the first-run welcome tasks so tests start from an empty list. */
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.addInitScript(() => localStorage.setItem('clear-onboarded', '1'));
    await run(page);
  },
});
export { expect };

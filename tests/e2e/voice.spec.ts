import { test, expect } from './fixtures';

// Chrome's fake microphone feeds MediaRecorder; speech recognition is replaced by a scripted fake
// that behaves like Android Chrome: cumulative results, and it ends itself after about a second.
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('clear-settings', JSON.stringify({ state: { theme: 'light', voiceLang: 'pt-PT' }, version: 0 }));
    const sessions = [
      [{ t: 'compra', final: false }, { t: 'comprar leite', final: true }],
      [{ t: 'comprar leite', final: true }, { t: 'ligar à mãe', final: true }],
    ];
    const log = { starts: 0, langs: [] as string[] };
    (window as unknown as { __speech: typeof log }).__speech = log;
    type Res = { isFinal: boolean; 0: { transcript: string } };
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((e: { resultIndex: number; results: Res[] }) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      private timers: number[] = [];
      start() {
        const script = sessions[log.starts] ?? [];
        log.starts++;
        log.langs.push(this.lang);
        const results: Res[] = [];
        script.forEach((r, i) =>
          this.timers.push(
            window.setTimeout(() => {
              // Android re-sends earlier results, and an interim one is replaced by its final form
              if (results.length && !results[results.length - 1].isFinal) results.pop();
              results.push({ isFinal: r.final, 0: { transcript: r.t } });
              this.onresult?.({ resultIndex: 0, results: [...results] });
            }, 200 * (i + 1)),
          ),
        );
        this.timers.push(window.setTimeout(() => this.end(), 1200));
      }
      stop() {
        this.end();
      }
      abort() {
        this.end();
      }
      private end() {
        this.timers.forEach(clearTimeout);
        this.timers = [];
        window.setTimeout(() => this.onend?.(), 0);
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
});

test('recording lasts until stopped, across recognition restarts, without repeated words', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain dump' }).click();
  await page.getByRole('button', { name: 'Record voice' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();

  // well past the point where recognition ended on its own (twice), it is still recording
  await page.waitForTimeout(4000);
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /0:0[3-9]/ })).toBeVisible();
  const log = await page.evaluate(() => (window as unknown as { __speech: { starts: number; langs: string[] } }).__speech);
  expect(log.starts).toBeGreaterThanOrEqual(3);
  expect(log.langs[0]).toBe('pt-PT');

  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByRole('button', { name: 'Record voice' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Brain dump' })).toHaveValue('comprar leite ligar à mãe');
  await expect(page.getByLabel('Recording 1', { exact: true })).toBeAttached();
});

test('Done while recording keeps the words and the audio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain dump' }).click();
  await page.getByRole('button', { name: 'Record voice' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await expect(page.getByText('comprar leite')).toBeVisible();
});

test('on a phone the brain dump opens without the keyboard, mic in thumb reach', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain dump' }).click();
  const area = page.getByRole('textbox', { name: 'Brain dump' });
  await expect(area).not.toBeFocused();
  const mic = page.getByRole('button', { name: 'Record voice' });
  await expect(mic).toBeInViewport({ ratio: 1 });
  const box = (await mic.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(60);
  expect(box.y).toBeGreaterThan(vp.height / 2); // lower half
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4); // centered
});

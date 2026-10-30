# HANDOFF

_Last updated: 2026-10-30_

## Current state
Phases 0–5 built, plus a **visual refresh** (PLAN "Phase 6.5"). `typecheck`, `lint`, `test` (127 unit) and `test:e2e` (36 pass, 8 skip because they are mouse-only, touch-only or phone-only) pass.

Latest round: **voice fixes** (PLAN "Phase 5.6", user feedback from a Redmi on Android Chrome).
- Recordings stopped at ~5s because the recorder was stopped when Android ended speech recognition. Now the recorder owns the session: only Stop/Done/close end it, and recognition restarts underneath (up to 3 failed sessions, then "Live transcript stopped. Still recording"). There is a wake lock and an elapsed timer. `stop()` returns a promise, and Done awaits it so the last words and the audio are saved.
- Transcript: `domain/transcript.ts` collapses Android's cumulative/repeated results, including across restarts. Recognition is given a clone of the recorder's mic track (newer Chrome; ignored elsewhere, and dropped after an `audio-capture` error). There's a new **Voice language** setting in the ⋯ menu (`settings.voiceLang`; default device language).
- Phone brain dump opens without focusing the text, so no keyboard. Bottom row: Organize · big mic · Done. `Sheet full` sizes itself to `visualViewport`, so that row stays above the keyboard. Starting a recording blurs the text. Hold-to-talk now needs a 600ms hold.
- Fixed a race where one dump could be created twice (`ensureId` is now single-flight).
- `tests/e2e/voice.spec.ts` uses Chrome's fake mic and a scripted Android-like recognizer.

Latest round (user feedback): row tap opens details; subtasks in the detail sheet now share the task-row look (round checkbox, inline edit, swipe, drag, hover delete); checkbox ring no longer tinted by urgency; **brain dump reworked** — header button on every view (+ `b`, + FAB long-press), saved to a new **Inbox** view (count badge) without organizing, several can wait, reopen/edit/delete, Organize later via the review screen (undo restores the dump). Voice now always records the original audio (playable, multiple per dump) next to an editable live transcript. Data: `dumps` table (Dexie v3), `data/dumps.ts`. Removed the "Keep voice recordings" setting and the drafts store. Fixed a race where two quick subtask adds could drop one (`repo.addSubtask`).

Sync (built, not yet live): Supabase magic-link auth + `clear_tasks/tags/dumps` tables, engine syncs tasks, tags and dumps (see `docs/SETUP.md`, `supabase/schema.sql`, `.github/workflows/deploy.yml`, `src/features/sync`). UI is the Sync section in the ⋯ menu, hidden unless `VITE_SUPABASE_*` are set. **Needs the owner**: run the SQL, add redirect URLs, set the two GitHub Actions variables, create the repo and push. Real magic-link/realtime flow is untested. Deploys to GitHub Pages under `/<repo>/` via `VITE_BASE`.

Round 3: **drag reorder smoothness** — `TaskRow` is memoized and tags load once per list (was one live query per row), so a swap no longer re-renders every row; `tests/e2e/dragsmooth.spec.ts` measures frame jumps/order flips for a mouse drag (passes, but the jitter was never reproducible headless, so **verify on a real phone**). **Tasks with subtasks**: first tap expands them inline, second tap opens details. **Subtasks are categorizable**: optional due/urgency/effort/tags (`Subtask` type), an options button per subtask in the detail sheet, pills on the rows, and quick-add smart syntax in the "Add subtask" field. Not yet: subtasks do not appear in Upcoming or sorting, and brain-dump subtasks stay plain text. `addSubtask` is now serialized.

Earlier this session:
- **Light-first theme.** Warm canvas, white cards, iris accent. Theme setting (Light / Dark / System) in the ⋯ menu; default Light. `index.html` applies the saved theme before first paint.
- **Urgency and effort at a glance.** Color-coded pills on every row: urgency on a warm scale (amber/apricot/coral, also tints the checkbox ring), effort on a cool scale (mint/blue/violet, with a 1–3 bar meter). Shared labels/colors live in `src/features/tasks/levels.ts`.
- **Gestures.** Swipe right = complete, swipe left = delete (with Undo). Waiting moved off the swipe to the detail switch / `w`.
- **Drag to reorder.** Long-press + drag on touch, hover grip on desktop, Alt+↑/↓ on keyboard. Uses `useSortable` (see Round 4). `domain/reorderList.ts` (`planReorder`) re-keys; `repo.setOrders` writes it as one undo step. Dropping switches the view to Manual sort, with an undo toast.
- **Compact task detail.** A property list (Urgency, Effort, Due, Tags, Waiting) with segmented pills, Today/Tomorrow/Pick date presets, inline tag adding and a waiting switch. Subtasks can be dragged.
- **No API keys.** The AI "Smart organize" toggle was removed and brain dump always uses the local splitter. `api/` code is left in place but unused.

Round 4: **drag reorder rewritten** (`src/hooks/useSortable.ts`), replacing motion's `Reorder` for tasks and subtasks. The lifted row follows the pointer through a `y` motion value, neighbours spring aside, and the DOM order changes once on drop. Offsets are cleared in a layout effect so nothing jumps, and the edges auto-scroll. Rows use `layoutDependency` (the id set) so a drop doesn't also run a layout animation. On touch, the long-press is detected with touch events in `SwipeRow` (pointer events were cancelled by Android's scroll or selection takeover, so mobile drag never started), tracked through a non-passive `touchmove` on the list, and selection and the callout are blocked on rows. New e2e: CDP touch long-press drag (mobile) and subtask grip drag (desktop). Max frame jump while dragging went from <25px to 3px.

Round 5 (user feedback): **drops landed wherever you let go**. motion's `animate()` on the drag offsets reported "complete" before running, so the offsets were reset too early and the animation then wrote them back. `useSortable` now eases offsets with its own rAF tween (`tween`/`stopTween`), and e2e checks that rows don't overlap after a drop (`expectSettled`). The **lift no longer scales** (scale blurred the text); it uses the shadow only, with offsets rounded to whole pixels. **Mobile quick add is inline**: the FAB shows the same input atop the list (focused inside the tap via `flushSync`, so iOS raises the keyboard). It stays open for rapid entry and closes when blurred empty. **Brain dump on mobile is a full-screen page** (`Sheet full`): no slide-up, and focus uses `preventScroll`, so the screen no longer jumps when the keyboard opens.

## Next steps
1. **Real-device voice test** on the Redmi (Chrome) and iOS Safari, served over HTTPS (the mic needs it): a 1–2 minute recording, the transcript in pt-PT, the keyboard-up layout, and whether Android plays a beep on each recognition restart. Headless tests can't check the real keyboard or the speech service.
2. If transcription is still poor after setting the language, decide: on-device Whisper (large download plus a new dependency) or the parked `api/transcribe` (needs an API key).
3. **Real-device test** (iOS Safari, Android Chrome): long-press-drag (now passes with emulated CDP touch, still unconfirmed on a phone), swipes, haptics, voice, PWA install.
4. Phase 7: accessibility audit (axe, VoiceOver/TalkBack), Lighthouse PWA check, real app icons, deploy.
5. Optionally delete `api/` (except perhaps `transcribe`) and the `smartOrganize` setting, now that AI is parked.

## Open decisions
- **Sync (Phase 6)** needs a hosted backend (Supabase keys). That conflicts with "nothing that needs keys", so it is on hold. The local engine (`src/domain/merge.ts`, `src/data/sync.ts`) is built and tested. Decide: keep the app single-device with export/import, or accept a backend.
- Live transcript works only where the browser has Web Speech (Chrome, Safari). The recording works everywhere MediaRecorder does. Better transcription means on-device Whisper or the parked server route (see Next steps).

## Decisions (adopted)
PWA · light theme default · Vercel · name "Clear" · subtasks one level · "Waiting" is a status · "Effort", not "difficulty" · review screen before brain-dump tasks are created · undo toasts, never confirm dialogs · no features that need API keys.
The ⋯ menu holds sort, tag filter, theme, brain dump, Done, tags, backup and audio toggle, keeping the main UI bare.

## Gotchas
- Package majors are newer than the docs assume (React 19, Vite 8, Vitest 5, motion 14, zod 4, vite-plugin-pwa 2).
- `chrono-node/en` is imported (not the root) to keep the bundle small.
- e2e tests set `clear-onboarded` via `tests/e2e/fixtures.ts`. Wait for the toast before reloading, since writes are async.
- Don't reintroduce `Reorder` / `dragControls.start` for touch long-press: they need a live pointer, which Android cancels. Don't drive drag offsets with motion's `animate()` either (see Round 5).
- The row's drag grip is `aria-hidden` on purpose. Keyboard users reorder with Alt+↑/↓, and a labelled grip would collide with title-based locators.
- Swipe labels ("Done"/"Delete") sit inside each row, so use `getByText(title, { exact: true })` in tests, not `hasText`.
- iOS: `navigator.vibrate` is unsupported (it fails silently). PWA storage can be evicted, so `navigator.storage.persist()` is requested at start.
- **Phone testing:** the laptop's wired UC network (`cnc.uc.pt`) keeps devices apart, so the `--host` LAN link doesn't reach the phone, and the mic needs HTTPS anyway. Run `npm run dev`, then `cloudflared tunnel --url http://localhost:<port>` (installed via winget) and open the printed `https://…trycloudflare.com` link on the phone. `vite.config.ts` allows `.trycloudflare.com` hosts. The link changes each run and is public while it runs.

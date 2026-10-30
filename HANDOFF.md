# HANDOFF

_Last updated: 2026-10-30_

## Current state
Phases 0–5 built, plus a **visual refresh** (PLAN "Phase 6.5"). `typecheck`, `lint`, `test` (114 unit) and `test:e2e` (31 specs pass, 7 skip because they are mouse-only or touch-only) pass. Checked in the browser at 375px and desktop width, light theme.

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
1. **Real-device voice test**: recording + playback + live transcript could not be exercised in headless tests (no microphone). Check on Chrome/Android and iOS Safari (iOS may not run Web Speech and MediaRecorder together; the code falls back to audio-only).
1. **Real-device test** (iOS Safari, Android Chrome): long-press-drag (now passes with emulated CDP touch, still unconfirmed on a phone), swipes, haptics, voice, PWA install.
2. Phase 7: accessibility audit (axe, VoiceOver/TalkBack), Lighthouse PWA check, real app icons, deploy.
3. Optionally delete `api/` and the `smartOrganize` setting, now that AI is parked.

## Open decisions
- **Sync (Phase 6)** needs a hosted backend (Supabase keys). That conflicts with "nothing that needs keys", so it is on hold. The local engine (`src/domain/merge.ts`, `src/data/sync.ts`) is built and tested. Decide: keep the app single-device with export/import, or accept a backend.
- Voice works only where the browser has Web Speech (Chrome, Safari). The server transcription fallback is parked.

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

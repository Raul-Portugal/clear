# HANDOFF

_Last updated: 2026-10-30_

## Current state
Phases 0–5.6 and the visual refresh (6.5) are built. **Live at https://raul-portugal.github.io/clear/**: GitHub Pages deploys on every push to `main` (`.github/workflows/deploy.yml` runs the tests first). `typecheck`, `lint`, `test` (130 unit) and `build` pass; e2e last passed with 36 run and 8 skipped (mouse-only, touch-only or phone-only).

**Sync (Phase 6) is built and deployed but not working end to end yet.** Supabase is set up: `supabase/schema.sql` is applied, the `VITE_SUPABASE_*` GitHub variables are set, and the live ⋯ menu shows the Sync section. The first real magic-link sign-in landed on `localhost:3000` with `otp_expired`, because the Pages URL was not in Supabase's **Redirect URLs**, so Supabase fell back to its default Site URL. **Owner action:** add `https://raul-portugal.github.io/clear/**` there (docs/SETUP.md §1.2), then request a fresh link. The app now shows a toast ("That sign-in link expired…") and clears the hash when it opens with a failed link (`features/sync/authLink.ts`).

What exists, briefly:
- **Capture:** inline quick add with smart syntax; brain dump saved to an **Inbox** (several dumps, reopen/edit/delete, Organize later through a review screen); voice records the original audio until the user stops it, with a live transcript where Web Speech exists (recognition restarts under the recording on Android) and a Voice language setting.
- **Tasks:** one level of subtasks (which can have their own due/urgency/effort/tags), urgency and effort pills, waiting status, tags, five sorts, Now/Upcoming/Waiting/Inbox/Done views, search.
- **Interaction:** row tap opens details (first tap expands subtasks if any); swipe right completes, swipe left deletes with undo; long-press drag reorders via `hooks/useSortable.ts`; full keyboard map, `?` cheat sheet, `⌘K` palette.
- **Sync:** `domain/merge.ts` + `data/sync.ts` engine (LWW per item, tombstones), `data/supabase.ts` adapter, `features/sync/useSync.ts` lifecycle with Realtime. Audio does not sync.
- **Parked:** `api/parse-dump` and `api/transcribe` (need an API key). The client still has a dead `smartOrganize` setting and a `/api/parse-dump` call.

## Next steps
1. **Finish sync:** after fixing the Redirect URLs, sign in on the laptop and phone from the live URL. Check that an edit on one device appears on the other within seconds, and that offline edits merge on reconnect.
2. **Real-device test using the live URL** (the HTTPS tunnel is no longer needed): Redmi/Chrome and iOS Safari. Voice (1–2 min in pt-PT, keyboard-up layout, beeps on recognition restart), long-press drag, swipes, haptics, PWA install.
3. If transcription is still poor: decide between on-device Whisper (big download plus a dependency) and the parked `api/transcribe` (needs a key).
4. Phase 7: axe audit (two buttons have no accessible name: a per-row button and the backup-import file input), VoiceOver/TalkBack, Lighthouse PWA, real icons, code-split Supabase and voice (main chunk 538 KB), remove the `smartOrganize`/`parse-dump` leftovers. Esc didn't close the mobile search field in a quick check; look into it.
5. v2 candidates: recurring tasks, reminders. Subtasks don't yet appear in Upcoming or sorting, and brain-dump subtasks stay plain text.

## Open decisions
- Transcription quality (see Next steps 3).
- Custom domain or stay on github.io.

## Decisions (adopted)
PWA · light theme default · GitHub Pages hosting · name "Clear" · subtasks one level · "Waiting" is a status · "Effort", not "difficulty" · review screen before brain-dump tasks are created · undo toasts, never confirm dialogs · no features that need API keys, **except optional sync** (public Supabase key, hidden when unconfigured, app works fully offline without it).
The ⋯ menu holds sort, theme, voice language, sync, Done, tags and backup, keeping the main UI bare.

## Gotchas
- Package majors are newer than the docs assume (React 19, Vite 8, Vitest 5, motion 14, zod 4, vite-plugin-pwa 2).
- `chrono-node/en` is imported (not the root) to keep the bundle small.
- e2e tests set `clear-onboarded` via `tests/e2e/fixtures.ts`. Wait for the toast before reloading, since writes are async.
- Don't reintroduce `Reorder` / `dragControls.start` for touch long-press: they need a live pointer, which Android cancels. Don't drive drag offsets with motion's `animate()` (it can report done early); `useSortable` uses its own rAF tween.
- The row's drag grip is `aria-hidden` on purpose. Keyboard users reorder with Alt+↑/↓, and a labelled grip would collide with title-based locators.
- Swipe labels ("Done"/"Delete") sit inside each row, so use `getByText(title, { exact: true })` in tests, not `hasText`.
- iOS: `navigator.vibrate` is unsupported (it fails silently). PWA storage can be evicted, so `navigator.storage.persist()` is requested at start.
- Supabase magic links: one use, one hour, and a new request invalidates older links. Redirects not on the allow list silently go to the Site URL.
- **Phone testing:** use the live Pages URL. For an unpushed build, the UC wired network (`cnc.uc.pt`) keeps devices apart, so run `npm run dev` plus `cloudflared tunnel --url http://localhost:<port>` (allowed in `vite.config.ts`); that link is public while it runs.

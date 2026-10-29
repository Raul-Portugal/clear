# Implementation Plan

Each phase ends with something usable and demoable. Check the boxes as work lands. At the end of every session, update `HANDOFF.md`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` parked

---

## Phase 0 — Foundation
Goal: an empty app shell that looks right on phone and laptop and installs as a PWA.

- [ ] Resolve the open decisions — defaults adopted; see HANDOFF in HANDOFF.md (stack, sync, AI)
- [x] `git init`, add `.gitignore`, scaffold Vite + React + TS (strict), ESLint + Prettier
- [x] Install the core dependencies (see ARCHITECTURE.md)
- [x] `src/styles/tokens.css` + `global.css` from DESIGN.md, with light and dark themes
- [x] App shell: mobile bottom bar / desktop left rail, switched by a `useMediaQuery` breakpoint
- [x] UI primitives: `Button`, `Checkbox`, `Chip`, `Sheet` (drag-to-dismiss), `Toast`
- [x] `vite-plugin-pwa`: manifest, icons, offline shell
- [x] Vitest + Playwright configured with `desktop` and `mobile` (iPhone 14) projects
- [x] npm scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`, `typecheck`

**Done when:** `npm run build` passes, the Lighthouse PWA check passes, and the shell renders correctly at 390px and 1440px in both themes.

## Phase 1 — Core tasks
Goal: a fully working basic to-do list that persists offline.

- [x] `domain/types.ts` holding the data model from ARCHITECTURE.md
- [x] Dexie schema with `tasks`, `tags` and `drafts` tables, plus repository functions (create, update, complete, softDelete, reorder)
- [x] Undo stack in the repository layer, wired to the toast and `⌘Z`
- [x] `TaskList` + `TaskRow` (anatomy from DESIGN.md) with layout animations
- [x] Quick add, plain title only for now
- [x] Complete/uncomplete with the micro-animation; a Done log view
- [x] Task detail (mobile sheet / desktop side panel): title, notes, due, urgency, effort
- [x] Subtasks: add, complete, reorder and delete inside the detail; inline expand on tap; `2/5` progress shown on the row
- [x] Unit tests for the repositories and the undo stack. E2E test: add → complete → undo

**Done when:** you can manage tasks with subtasks on both form factors and everything survives a reload while offline.

## Phase 2 — Organization
- [x] Tags: create them inline, auto-color them, rename/recolor/delete them in Settings
- [x] Tag filter sheet plus the active-filter pill, persisted per view
- [x] `domain/sort.ts` with Smart, Urgency, Effort, Due and Manual sorts (fully unit-tested, including tie-breaks)
- [x] Sort control, remembered per view
- [x] Waiting status: the waiting-on text, a follow-up date, a Waiting view, and auto-resurfacing on the follow-up date
- [x] Upcoming view grouped by day; overdue/today grouping in Now
- [x] Search over titles, notes and subtasks
- [x] `domain/parseQuickAdd.ts` smart syntax (dates via chrono, `!`, `~`, `#`, `@waiting`) with live token chips in quick add

**Done when:** every field from SPEC §2 can be set, filtered and sorted, and quick add parses `Call dentist tomorrow 10am !high #health ~quick` correctly.

## Phase 3 — Gestures, keyboard & polish
- [x] `SwipeRow` primitive: swipe right to complete, swipe left to delete, plus haptics (waiting moved to the detail switch / `w`)
- [x] Drag reorder — long-press + drag on touch, hover grip on desktop, Alt+↑/↓ on keyboard; re-keys via `domain/reorderList.ts` and switches to Manual
- [x] Pull-to-search; long-press **+** to open voice (stub until Phase 5)
- [x] Keyboard shortcuts (SPEC §6), the `?` cheat sheet, and the `⌘K` command palette
- [x] Reduced-motion support, focus rings, ARIA labels, and screen-reader alternatives for every gesture
- [ ] Test on a real phone — needs a physical device (iOS Safari + Android Chrome) via `vite --host` / an HTTPS tunnel

**Done when:** the full task lifecycle works with gestures alone on a phone and with the keyboard alone on a laptop.

## Phase 4 — Brain dump
- [x] Full-screen brain dump editor; the draft autosaves to Dexie
- [x] `domain/splitDump.ts`: a local splitter for lines, bullets and sentences that reuses `parseQuickAdd`, with unit tests built from realistic messy inputs
- [x] Review screen: editable proposed-task cards with toggle, edit, merge-up and turn-into-subtask actions, plus "Add N tasks"
- [-] Parked (no API keys): `api/parse-dump` serverless — written and unit-tested; not yet run against the live API function calling Claude (`claude-haiku-5-5`) with a strict JSON schema via tool use; zod validation; rate limiting
- [-] Removed from the menu: settings toggle "Smart organize (AI)" (parked with the endpoint)
- [x] Fallback to the local splitter when offline or when the call errors

**Done when:** a messy paragraph becomes clean, correctly tagged and dated tasks after a single review step.

## Phase 5 — Voice capture
- [x] Hold-to-talk mic in brain dump using the Web Speech API, with live transcript
- [-] Parked (needs a paid API key): `MediaRecorder` fallback — client done; needs a provider configured, plus `api/transcribe` (provider to be chosen)
- [x] Optionally keep the audio note attached (stored as a Blob in IndexedDB)
- [x] Mic permission UX, and a recording indicator with waveform

**Done when:** from the phone home screen, long-pressing + and speaking a few to-dos ends in reviewed tasks.

## Phase 5.5 — Brain dump inbox (user feedback)
- [x] Brain dump button in every view header; Inbox view with count; `b` shortcut
- [x] Dumps are saved without organizing; several can wait; reopen, edit, delete with undo
- [x] Organize later from the editor or an Inbox card, through the review screen
- [x] Voice always records the original audio, with playback beside the (editable) transcript
- [x] Row tap opens details; subtasks share the task-row look and gestures; no urgency tint on the checkbox

## Phase 6 — Sync across devices
- [ ] Auth (email magic link)
- [ ] Remote schema mirroring Task and Tag; row-level security
- [~] Sync engine: push and pull by `updatedAt`, LWW per task, tombstones, a background retry queue — engine + merge done against a `RemoteStore` interface; no Supabase adapter yet
- [ ] Realtime updates when the app is open on both devices
- [x] Export and import JSON (also serves as a backup)

**Done when:** a task edited on the laptop appears on the phone within seconds, and offline edits merge on reconnect.

## Phase 6.5 — Visual refresh (2026-10-29)
- [x] Light-first theme: warm canvas, white cards, iris accent; dark/system as a menu setting
- [x] Color-coded urgency (warm) and effort (cool) pills on every row, urgency-tinted checkbox
- [x] Compact task detail: property list with segmented pills, date presets, inline tag adding, waiting switch, draggable subtasks
- [x] Nav with icons and counts; card-style quick add; pill toasts with Undo

## Phase 7 — Launch polish
- [x] Onboarding: 3 sample tasks that teach the gestures (deletable)
- [x] Performance pass: `content-visibility` on rows instead of virtualization; main bundle ~190KB gzip
- [ ] Accessibility audit (axe plus manual VoiceOver/TalkBack)
- [ ] Deploy (Vercel / Netlify / Cloudflare Pages) with a custom domain

## Later / v2 candidates
Recurring tasks · reminders/notifications · calendar view · Capacitor native builds · shared lists · widgets.

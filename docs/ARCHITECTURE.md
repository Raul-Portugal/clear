# Architecture

## Stack (proposed — confirm before Phase 0, see HANDOFF.md "Open decisions")

| Concern | Choice | Why |
|---|---|---|
| Platform | **PWA** (installable web app) | One codebase for laptop and phone, installable to the home screen, works offline. A native wrapper (Capacitor) can come later if needed. |
| UI | React 18 + TypeScript (strict) + Vite | Mainstream and fast to iterate on. |
| Styling | CSS Modules + CSS custom properties (design tokens) | Gives full control over a bespoke look. Tokens live in `src/styles/tokens.css`. |
| State | Zustand | Small, with no boilerplate. |
| Local storage | Dexie (IndexedDB) | Offline-first source of truth on each device. |
| Gestures | `@use-gesture/react` | Reliable pointer-based swipes, drags and long-presses. |
| Animation | `motion` (Framer Motion) | Spring physics, layout animations, and `AnimatePresence` for list changes. |
| Date parsing | `chrono-node` | Natural-language dates for quick add. |
| PWA | `vite-plugin-pwa` (Workbox) | Service worker, manifest, offline caching. |
| Tests | Vitest + Testing Library, Playwright (desktop + mobile viewport projects) | |
| AI parsing | **Parked.** A serverless prototype stays in `api/`, but the app never calls it | Product decision: no features that need API keys. Brain dump uses the local splitter only. |
| Sync (Phase 6) | Supabase (Postgres + Auth magic link + Realtime), optional | Hidden unless `VITE_SUPABASE_*` are set. Setup in `docs/SETUP.md`, schema in `supabase/schema.sql`. |
| Hosting | GitHub Pages via `.github/workflows/deploy.yml` | Free, HTTPS (needed for the mic). Served under `/clear/` (`VITE_BASE`). |

## Folder layout

```
src/
  app/            # App shell, routing, layout (mobile vs desktop)
  features/
    tasks/        # TaskList, TaskRow, TaskDetail, subtasks
    capture/      # QuickAdd, BrainDump, Review, voice
    filters/      # tag filter, sort, search
  domain/         # pure TS: types, sorting, smart-syntax parser, brain-dump splitter (no React, 100% unit-tested)
  data/           # Dexie db, repositories, sync engine, Supabase adapter
  ui/             # design-system primitives: Button, Sheet, Chip, Toast, Checkbox, SwipeRow
  hooks/          # useKeyboardShortcuts, useUndo, useMediaQuery, useHaptics
  styles/         # tokens.css, global.css
api/              # serverless functions (parse-dump, transcribe)
tests/e2e/        # Playwright
```

**Rule:** `domain/` has no dependencies on React, Dexie or the browser. All of the business logic (sorting, parsing, smart grouping) lives there and is unit-tested.

## Data model

```ts
type Urgency = 0 | 1 | 2 | 3;               // none, low, medium, high
type Effort  = 'quick' | 'medium' | 'deep';
type Status  = 'open' | 'waiting' | 'done';

interface Task {
  id: string;            // uuid v7 (time-sortable)
  title: string;
  notes?: string;
  status: Status;
  urgency: Urgency;
  effort?: Effort;
  due?: { date: string; time?: string };   // ISO date 'YYYY-MM-DD', optional 'HH:mm' (local)
  tagIds: string[];
  waiting?: { on?: string; followUp?: string };  // followUp: ISO date
  subtasks: Subtask[];   // embedded: one level, always loaded with parent
  order: string;         // fractional index (e.g. 'a0', 'a0V') for cheap manual reordering
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  deletedAt?: number;    // soft delete → enables undo + sync tombstones
  audioNoteId?: string;
}

interface Subtask { id: string; title: string; done: boolean; }

interface Tag { id: string; name: string; color: string; order: string; }

interface Draft { id: 'brain-dump'; text: string; updatedAt: number; }
```

Subtasks are embedded in their parent task because they are only one level deep and always shown with it. This keeps reads trivial and makes sync atomic per task.

## Key flows

**Undo:** every mutation goes through `data/repo.ts`, which records the inverse operation on an in-memory undo stack (max 20 entries). The toast and `⌘Z` both pop from that stack.

**Smart syntax parsing:** `domain/parseQuickAdd(input, existingTags, now)` returns `{ title, due, urgency, effort, tags, status, tokens[] }`. `tokens` holds the character ranges, so the UI can render chips and undo an individual parse.

**Brain dump:**
1. `domain/splitDump(text)` is a local, deterministic splitter. It handles lines, bullets and sentence boundaries, and runs `parseQuickAdd` on each piece. This always works offline.
2. (Parked; the app never enables it.) When AI parsing is enabled and online, the client calls `POST /api/parse-dump { text, tags, today }` and gets back `{ tasks: ProposedTask[] }`, validated with zod. The server uses Claude tool use / structured output so it always gets JSON that matches the schema. If the call fails, the client falls back to step 1.
3. The review UI edits `ProposedTask[]`, and committing writes them in a single transaction.

**Voice** (`hooks/useVoice.ts`): `MediaRecorder` records the original audio and owns the session: only the user stops it. Where the Web Speech API exists, recognition runs alongside and is restarted whenever the browser ends it (silence, Android's limit), giving up after 3 failed sessions while the recording continues. It is handed the recorder's mic track where Chrome supports that. Results are rebuilt per event and collapsed with `domain/transcript.ts` (Android sends cumulative and repeated results), and only new words are appended. Server transcription (`/api/transcribe`) is parked: it needs an API key.

**Sync (Phase 6):** local-first. Dexie stays the source of truth for the UI. A sync engine pushes changed rows (by `updatedAt`) and pulls remote changes. Conflicts are resolved with last-write-wins per task. Soft deletes act as tombstones. `data/supabase.ts` is the remote adapter (tables `clear_tasks/tags/dumps`, keyed by `user_id,id`, row-level security); `features/sync/useSync.ts` follows the auth session and syncs on start, on focus/online, after local changes (debounced) and on Realtime events. Voice audio does not sync.

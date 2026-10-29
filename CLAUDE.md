# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is
"Clear" (working title) is a minimal, offline-first to-do PWA for laptop and phone. It has tasks with one level of subtasks, due dates, urgency, effort, tags, a "waiting for input" status, brain-dump and voice capture, gestures on mobile and shortcuts on desktop. **Clean and clutter-free is the core feature.**

## Read first
- `HANDOFF.md`: current state, what's next, open decisions. **Always read this at the start of a session.**
- `docs/SPEC.md`: product behavior (the source of truth for *what*)
- `docs/DESIGN.md`: visual and interaction rules (the source of truth for *how it looks/feels*)
- `docs/ARCHITECTURE.md`: stack, folder layout, data model
- `docs/PLAN.md`: phased checklist (the source of truth for *what's next*)

## Commands
```
npm run dev        # dev server (add --host to test on phone over LAN)
npm run build
npm test           # vitest
npm run test:e2e   # playwright (desktop + mobile projects)
npm run lint
npm run typecheck
```

## Working rules
1. **Work phase by phase from `docs/PLAN.md`.** Don't build features from later phases early. Tick the checkboxes as items land.
2. **Guard the minimalism.** Before adding any visible UI element, check DESIGN.md's "Rules of restraint". Prefer progressive disclosure: show it only when it's relevant, or make it a gesture or shortcut. If a spec item seems to need clutter, stop and propose an alternative instead.
3. **Business logic lives in `src/domain/`** as pure TypeScript with no React or Dexie imports, and it has unit tests. Sorting, quick-add parsing and brain-dump splitting all go there.
4. **All mutations go through `src/data/` repositories** so that undo and (later) sync work. Never write to Dexie directly from components.
5. **Undo, never confirm.** Destructive actions use soft delete plus an undo toast.
6. **Every gesture has a non-gesture equivalent** (detail sheet or keyboard) and an accessible label.
7. **Use design tokens only.** No raw hex colors, px font sizes or ad-hoc spacing in components. Use `var(--…)` from `src/styles/tokens.css`.
8. **Test both form factors.** UI changes are verified at 390px (mobile) and 1440px (desktop), in light and dark themes. Playwright runs both projects.
9. **Respect `prefers-reduced-motion`.**
10. TypeScript strict mode, with no `any`. Use function components and hooks. CSS Modules.
11. Keep dependencies lean. Ask before adding anything not listed in ARCHITECTURE.md.
12. Never commit secrets. The Claude API key lives only in serverless env vars (`ANTHROPIC_API_KEY`) and never in client code.

## End of session
Update `HANDOFF.md`: what was done, the current state, next steps, any new decisions or open questions. Keep it short and current. Rewrite it; don't append forever.

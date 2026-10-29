# Design System & UX Guidelines

The visual goal is **quiet confidence**: a warm light canvas, soft white cards, one accent color, typography doing most of the work, and motion that feels physical but never shows off. **Light is the default theme**; dark and "follow system" are opt-in from the ⋯ menu.

## Rules of restraint

1. **One accent color** (iris `--accent`). It is used for the primary action, the active view and focus. Nothing else gets it.
2. **Two semantic scales, and only these:** urgency is a *warm* scale (amber → apricot → coral), effort is a *cool* scale (mint → blue → violet). Each level has a strong and a `-soft` token. They appear only on pills/rings for fields that are set.
3. **No borders around task rows.** Rows are soft white cards separated by spacing, with a shadow instead of a border.
4. **Icons are 20px, 1.5px stroke, monochrome**, from a single set (Lucide). They never appear beside text that already says the same thing.
5. **Metadata is muted and small.** It sits on one line under the title, and only when the fields are set: `Fri · #work · 2/5`.
6. **Empty states are calm**, with a single line of copy and no illustrations that shout.
7. **Max 3 text sizes per screen.**
8. Before adding any persistent on-screen element, ask: *could this be a gesture, shortcut, or appear only when relevant?*

## Tokens

The live values are in `src/styles/tokens.css` (light in `:root`, dark under `[data-theme='dark']`, or `[data-theme='system']` on a dark OS). The original starting point is kept below for reference.

```css
:root {
  /* color — light */
  --bg: #FAFAF9;  --surface: #FFFFFF;  --text: #1C1C1E;  --text-muted: #8A8A8E;
  --hairline: #ECECEC;  --accent: #3D5AFE;
  --success: #34C759;  --waiting: #FF9F0A;  --danger: #FF3B30;
  /* type */
  --font: "Inter", system-ui, -apple-system, sans-serif;
  --fs-title: 1.0625rem; --fs-meta: 0.8125rem; --fs-heading: 1.375rem;
  /* space (4px grid) */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s6: 24px; --s8: 32px;
  /* shape & motion */
  --radius: 12px; --radius-sm: 8px;
  --spring: cubic-bezier(.2,.8,.2,1); --dur: 220ms;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0E0E10; --surface: #18181B; --text: #F2F2F2; --text-muted: #8E8E93; --hairline: #2A2A2E; }
}
```

Tag colors come from a fixed palette of 8 desaturated hues, with variants tested for contrast on both themes.

## Task row anatomy

```
┌────────────────────────────────────────────────────────────┐
│ ◯  Call dentist about appointment     (● High) (▂▄▆ Quick) │  ← pills only when set
│    Tomorrow 10:00  #health  ☰ 1/3                          │  ← meta line only when set
└────────────────────────────────────────────────────────────┘
```
- Each row is a white card (`--surface`, `--shadow-xs`, `--radius`).
- **Urgency** at a glance: the checkbox ring and fill take the urgency color, plus a pill with a dot and `Low / Med / High`.
- **Effort** at a glance: a pill with a three-bar meter (1 bar quick, 3 bars deep) and its label. Below 480px the label hides and only the meter shows.
- On hover (mouse), a grip appears left of the card for drag-to-reorder.
- Touch target ≥ 44px. The checkbox hit area covers the whole left 48px.
- Overdue dates are shown in `--danger` text and nothing else changes. No banners.
- Waiting tasks show an hourglass glyph plus "Ana's reply" in `--waiting`.
- Completing a task fills the checkbox with a spring, strikes through the title for 300ms, then collapses the row.

## Motion

- Lists animate their layout (`motion` `layout` prop) so rows glide when sorting or filtering changes.
- Sheets use spring physics and follow the finger while being dragged to dismiss.
- Swipe rows fade in a rounded action card behind the row (green "Done" on the left, red "Delete" on the right). Passing the threshold scales the label and fires a haptic tick; releasing flings the row off.
- Dragging to reorder lifts the card (slight scale + larger shadow) while the others glide out of the way.

## Task detail

A compact property list in a sunken panel: `Urgency`, `Effort` (segmented pills in their scale colors), `Due` (Today / Tomorrow / Pick, then a date pill + time + clear), `Tags` (chips + a `+` that reveals an inline input), `Waiting` (a switch that reveals "on whom" and a follow-up pill). Notes and subtasks sit below; subtask grips and delete buttons only show on hover with a mouse.
- `prefers-reduced-motion` replaces every movement with a 120ms opacity fade.

## Responsive behavior

| | Phone (< 768px) | Laptop (≥ 1024px) |
|---|---|---|
| Navigation | Bottom bar (Now · Upcoming · Waiting) | Left rail |
| Add | FAB → bottom sheet | Inline input at top of list (`n`) |
| Detail | Full-height bottom sheet | Right side panel; list stays visible |
| Brain dump | Full screen | Centered focus modal |
| Primary input | Gestures | Keyboard |

Tablet (768–1023px) uses the phone layout with the wider list.

## Copy voice

Short, warm and literal. Examples: "Nothing left. Nice.", "Waiting on Ana", "3 tasks found — review before adding". No exclamation marks except in celebration moments, and keep those rare.

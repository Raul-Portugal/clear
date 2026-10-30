# Product Spec — "Clear" (working title)

A minimal to-do app for laptop and phone. It does a lot underneath and shows very little on the surface.

## 1. Product principles

These settle disagreements. When a feature conflicts with a principle, the principle wins.

1. **Calm by default.** A task row shows its title. Other details appear only when they are set and matter (due soon, high urgency, waiting). Nothing appears just because a field exists.
2. **Capture beats organize.** Getting a thought out of your head should take under 2 seconds. You can organize later, or never.
3. **Progressive disclosure.** Power features (sorting, tag filters, effort, brain dump) are one gesture or keystroke away. They never sit permanently on screen.
4. **Undo instead of confirm.** No "Are you sure?" dialogs. Every destructive or state-changing action shows an undo toast.
5. **One app, two native-feeling modes.** On a phone it is thumb-driven and gesture-first. On a laptop it is keyboard-first. Both share one visual language.
6. **Offline-first.** The app always opens instantly and works with no network.

## 2. Core concepts

### Task
| Field | Notes |
|---|---|
| Title | Required, single line. |
| Notes | Optional, multi-line, plain text with auto-linked URLs. |
| Subtasks | **One level only**, so there are no trees to manage. Each has a title and a done state. The parent shows progress as `2/5`. |
| Due date | Optional. Date with an optional time. Entered in natural language ("fri", "in 3 days", "tomorrow 9am"). |
| Urgency | `none · low · medium · high`. Default `none`. When set, it shows on the row as a color-coded pill (warm scale). |
| Effort (difficulty) | `quick · medium · deep`. Default unset. Named "effort" in the UI because "difficulty" sounds judgmental and effort is easier to act on ("quick wins"). |
| Tags | Zero or more. Lowercase, `#tag` syntax. Each tag gets an auto-assigned muted color the user can change. |
| Status | `open · waiting · done`. |
| Waiting on | Shown when status is `waiting`. Optional free text ("Ana's reply") and an optional follow-up date. |
| Order | Manual position, used when sort = Manual. |

### Waiting for input
A separate status, not a tag. Waiting tasks:
- drop out of the main "Now" list into their own **Waiting** view, so blocked work doesn't clutter what you can act on;
- come back to Now on their follow-up date, with a subtle "follow up" marker;
- can be returned to open in one action (swipe or `w` again).

## 3. Views & navigation

Keep the number of top-level places to a minimum:

- **Now** (home): open tasks, smart-sorted. Overdue and due-today tasks are grouped at the top under one quiet heading.
- **Upcoming**: tasks with due dates, grouped by day.
- **Waiting**: waiting tasks, grouped by follow-up date.
- **Inbox**: saved brain dumps waiting to be organized (text and voice recordings), newest first, with a quiet count. Not tasks.
- **Done**: a log of completed tasks. Kept out of the way and reached from the menu.

**Tag filtering** uses a single filter control, not a sidebar of tags. Tapping it opens a sheet of tag chips, and you can select several. While a filter is active, one dismissible pill at the top shows it (`#work · #home ×`). Filters persist per view until cleared.

**Search** is `/` on desktop and pull-down-then-type on mobile. It searches titles, notes and subtasks.

Mobile layout: the list fills the screen, a slim bottom bar holds Now, Upcoming, Waiting and Inbox, and a floating **+** button sits above it. Desktop layout: a narrow left rail with the views, a centered list (max ~680px wide), and the detail panel slides in from the right.

## 4. Sorting

A single "Sort" control with these options:
- **Smart** (default): overdue → due today → high urgency → due soon → rest. Within each group, quick effort comes first.
- **Urgency**: high → none, then by due date.
- **Effort**: quick → deep ("quick wins first"), with a toggle to reverse it.
- **Due date**
- **Manual**: drag to reorder.

The chosen sort is remembered per view.

## 5. Capture

### 5.1 Quick add (one task)
A single input with inline smart syntax. Recognized tokens turn into small chips as you type, and you can tap a chip to undo the parse:

```
Call dentist tomorrow 10am !high #health ~quick
```
| Token | Meaning |
|---|---|
| natural date (`tomorrow`, `fri`, `next week`, `12 nov`) | due date |
| `!low` `!med` `!high` (or `!`, `!!`, `!!!`) | urgency |
| `~quick` `~med` `~deep` | effort |
| `#tag` | tag (autocompletes existing tags) |
| `@waiting` or `waiting on X` | status = waiting |

Press Enter to save and keep the input open for the next task. Press Esc or swipe down to close.

### 5.2 Brain dump (collect now, sort later)
A key feature, so it is one tap from the main screen: a **Brain dump** button sits in every view's header (and the `b` key on desktop, long-press on the **+** FAB for voice).
- It opens a distraction-free text area with a mic. You write or speak freely, in prose, bullets or half sentences. **Nothing has to be sorted into tasks.** Closing it (Done, Esc, backdrop) saves it to the **Inbox**; an empty dump leaves nothing behind.
- You can keep several dumps waiting. Each one autosaves, can be reopened and edited, and can be deleted (with undo).
- **Organize** (from the editor, or on an Inbox card) is optional and can happen any time: the text is split into candidate tasks on-device (by line, bullet and sentence), a **review screen** lists them as editable cards (uncheck, edit, merge into the previous card, or make a subtask), and **Add N tasks** commits them. Nothing is created without this review. The dump then leaves the Inbox (undo brings it back, tasks removed).

### 5.3 Voice note
A mic button inside the brain dump (tap to start/stop, or hold to talk), plus a long-press on the **+** FAB on mobile.
- A recording lasts until the user stops it, however long that is. A quiet timer shows it is still going, and the screen is kept awake while recording.
- On a phone the brain dump opens **without the keyboard**: an empty page ("Tap to write, or use the mic") with a large mic centered at the bottom, so writing or speaking is one tap either way. Once typing, the bottom row (Organize · mic · Done) stays visible above the keyboard. Starting a recording dismisses the keyboard.
- The transcript language is a setting in the ⋯ menu (**Voice language**, default: device language).
- The **original audio is always recorded and kept** with the dump, with a player to listen back and a remove button. Several recordings can be added to one dump.
- Where the browser supports speech recognition, a live transcript is written into the text area. It is editable because transcripts can be wrong, and the audio is right beside it to check against. Where it does not, the recording is still kept and the user can type or just listen.
- Organizing a dump attaches its first recording to the tasks created from it.
- When sync is on, recordings sync with their dump, and removing one removes it everywhere.

## 6. Interaction

### Mobile gestures
| Gesture | Action |
|---|---|
| Tap task | Open the detail sheet. A task with subtasks expands them inline on the first tap; the second tap opens details |
| Tap checkbox | Complete (with satisfying micro-animation + undo toast) |
| Swipe right | Complete |
| Swipe left | Delete (undo toast) |
| Long-press + drag | Reorder (switches sort to Manual, with an undo toast saying so) |
| Pull down on list | Search |
| Tap **+** | Quick add |
| Long-press **+** | Voice brain dump |
| Swipe down on any sheet | Dismiss |
| Swipe right on subtask | Complete subtask |

Waiting is set from the detail sheet's switch or `w` (it is no longer a swipe, so left/right stay simple). On desktop, a grip appears on hover to drag a task; `Alt+↑/↓` does the same from the keyboard.

Every swipe shows its action color and icon as you drag, and passing the threshold triggers haptic feedback (`navigator.vibrate` where supported). Gestures are never the only way to do something: every action is also available in the detail sheet.

### Desktop keyboard
| Key | Action |
|---|---|
| `n` | Quick add |
| `b` | Brain dump |
| `/` | Search |
| `j` / `k` | Move selection |
| `Enter` | Open detail |
| `x` / `Space` | Complete |
| `w` | Toggle waiting |
| `1`–`3`, `0` | Set urgency |
| `e` | Cycle effort |
| `t` | Tag picker |
| `d` | Due date picker |
| `⌘/Ctrl+K` | Command palette (everything is searchable here) |
| `⌘/Ctrl+Z` | Undo |
| `?` | Shortcut cheat sheet |

## 7. Non-goals (v1)

Each of these is deliberately left out to keep the app clean. Any of them can be reconsidered later.
- Projects or folders (tags cover this)
- Nested subtasks deeper than one level
- Collaboration and shared lists
- Recurring tasks (strong v2 candidate)
- Calendar integration
- Attachments other than the optional voice note

## 8. Quality bar

- First paint < 1s on a mid-range phone, and the app is interactive offline.
- All interactions run at 60fps, and swipes track the finger exactly.
- WCAG AA contrast. Fully keyboard-operable. Screen-reader labels on all gesture actions. Respects `prefers-reduced-motion`.
- Light theme by default; dark and "follow system" are a setting in the ⋯ menu.
- No feature may require an API key (AI organizing and server transcription are parked). The one exception is optional sync: it uses a public Supabase key, is hidden unless configured, and the app works fully without it.

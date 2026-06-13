# Sync bracket selection between Field Intelligence and Bracket & Results

**Date:** 2026-06-13
**Status:** Approved, ready for implementation plan

## Problem

On the tournament detail page, two sections show the same brackets but keep
**independent selection state**:

- **Field Intelligence** (`components/event-breakdown.tsx`) — desktop master-detail
  list of *all* events. Clicking an event sets a local `selectedEventId` and
  highlights it (emerald). Mobile renders independent expandable cards with no
  single-selection concept.
- **Bracket & Results** (`components/live-bracket.tsx`) — tab pills for only the
  events that have match data (a subset of all events). Clicking a tab sets its
  own local `selectedEvent`.

The two are joined only by `event.id === match.event_id`. Selecting a bracket in
one section does nothing to the other.

## Goal

When a bracket is selected in Field Intelligence and that same bracket exists in
Bracket & Results, both sections should reflect the selection (the bracket is
"active/highlighted" in both). The sync is **bidirectional**.

## Scope

- **In scope:** desktop (lg+) Field Intelligence master-detail list ↔ Bracket &
  Results tabs (tabs render on both mobile and desktop).
- **Out of scope:** mobile Field Intelligence expandable cards. The single-
  highlighted-selection interaction only exists on desktop; mobile FI cards stay
  as-is and Bracket & Results tabs continue to work independently on mobile. No
  regression — the shared state simply has no mobile FI counterpart.

## Decisions

- **Direction:** bidirectional.
- **On Field Intelligence click → Bracket & Results:** smooth-scroll *down* to
  Bracket & Results so the matching bracket is visible.
- **On Bracket & Results tab click → Field Intelligence:** update selection
  silently, **no scroll** (the user is already looking at that section; yanking
  the page up to FI would be jarring).
- **Highlight cue:** reuse each section's existing selected/active styling
  (emerald list row in FI, emerald pill in B&R). No new highlight CSS.

## Approach: shared React Context

A `SelectedBracketProvider` client component wraps the page's grid. A
`Context.Provider` renders no DOM node, so it does not disturb the existing CSS
grid layout (the two sections live in different grid cells:
`field-intelligence` at `row-start-2`, bracket at `row-start-3`, podium at
`row-start-4`).

Rejected alternatives:

- **URL state** (`?bracket=<id>` / hash): deep-linkable but heavier (router
  writes, RSC + scroll quirks); shareable links were not requested.
- **Single merged wrapper component** rendering both sections: collapses the
  grid-cell layout the page depends on.

## Components

### New: `components/selected-bracket-context.tsx` (client)

Context shape:

```ts
selectedEventId: string | null;
hasBracket(id: string): boolean;        // is this event present in Bracket & Results?
selectFromFieldIntel(id: string): void; // set state; if hasBracket(id) → smooth-scroll to B&R
selectFromBracket(id: string): void;    // set state; no scroll
```

- Provider prop: `bracketEventIds: string[]` — the set of `event_id`s that appear
  in `matches`. Only the server (`page.tsx`) has both `events` and `matches`, so
  it computes this and passes it in. `hasBracket` is a membership check against
  this set.
- `selectFromFieldIntel(id)` sets `selectedEventId`, then, if `hasBracket(id)`,
  scrolls: `document.getElementById("bracket-results")?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- `selectFromBracket(id)` only sets `selectedEventId`.
- A `useSelectedBracket()` hook exposes the context.

### `app/[city]/tournaments/[id]/page.tsx`

- Compute `bracketEventIds` from `matches` (unique `event_id`s).
- Wrap the grid `<div className="lg:grid …">` in
  `<SelectedBracketProvider bracketEventIds={bracketEventIds}>`.
- Add `id="bracket-results"` and `scroll-mt-20` to the LiveBracket `<section>`
  (mirrors the existing `#field-intelligence` anchor pattern).

### `components/event-breakdown.tsx`

- Remove local `useState` for `selectedEventId`; read it from
  `useSelectedBracket()`.
- Derive `selectedEvent = events.find(e => e.id === selectedEventId) ?? orderedEvents[0]`
  (preserves current "default to first" behavior when nothing is selected).
- Desktop list button `onClick` → `selectFromFieldIntel(event.id)`.
- Highlight unchanged (existing emerald selected styling driven by
  `event.id === selectedEventId`).
- Mobile expandable cards: unchanged (out of scope).

### `components/live-bracket.tsx`

- Keep a local `localKey` state seeded from `eventKeys[0]` so selecting an
  FI-only bracket (one B&R doesn't have) does **not** reset the tab.
- Sync `localKey ← selectedEventId` via `useEffect`, **only when**
  `grouped.has(selectedEventId)` (i.e. the selected event is one B&R actually
  has). FI-only selections leave the B&R tab untouched.
- Tab `onClick` → `setLocalKey(key)` + `selectFromBracket(key)`.
- Render uses `localKey` (was `selectedEvent`).

## Behavior summary

| Action | Field Intelligence | Bracket & Results | Scroll |
|---|---|---|---|
| Click FI bracket that has matches | selected | tab switches to it | scroll down to B&R |
| Click FI bracket with no matches | selected | unchanged | none |
| Click B&R tab | detail switches to it | selected | none |
| Initial load | first by FI order | first B&R tab | none (no forced alignment) |

## Testing

This codebase's vitest setup runs in a **node environment** and tests pure logic
only (`test/**/*.test.ts`); jsdom and React Testing Library are not installed, and
component tests are not a convention here (see `lib/field-intel.ts` +
`test/field-intel.test.ts`). So the non-trivial decision is extracted into a pure
helper and unit-tested; the component/provider wiring is verified by running the
app.

- Extract `nextBracketKey(selectedEventId, eventKeys, currentKey)` into
  `lib/selected-bracket-logic.ts` — returns the shared selection only when
  Bracket & Results actually has that event, otherwise keeps the current tab (so
  an FI-only selection never resets the B&R tab). Unit-test it.
- Verify wiring manually via the dev server: a FI click selects + scrolls to the
  matching B&R bracket; a B&R tab click updates the FI detail; an FI-only bracket
  leaves the B&R tab put and does not scroll.

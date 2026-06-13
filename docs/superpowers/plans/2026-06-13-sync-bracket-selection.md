# Sync Bracket Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selecting a bracket in Field Intelligence and in Bracket & Results stay in sync — selecting one highlights the matching bracket in the other (bidirectional), and a Field Intelligence selection scrolls down to its bracket in Bracket & Results.

**Architecture:** Lift the selected event id into a shared React Context (`SelectedBracketProvider`) that wraps the tournament page's grid. The provider renders no DOM node, so the existing CSS grid layout is untouched. `EventBreakdown` and `LiveBracket` read/write the shared `selectedEventId`. The one non-trivial rule (Bracket & Results adopts the shared selection only when it actually has that event) is a pure, unit-tested helper. Desktop-only; mobile is out of scope.

**Tech Stack:** Next.js App Router (React 19), TypeScript, Tailwind, Vitest (node environment, pure-logic tests).

**Spec:** `docs/superpowers/specs/2026-06-13-sync-bracket-selection-design.md`

**Working directory:** All paths are relative to the repo root `/Users/benjaminpoon/dev/pickleradar`. Run all commands from there.

---

### Task 1: Pure selection helper + test

The only non-obvious logic: Bracket & Results should follow the shared selection
only when it actually has that event; an FI-only selection must not reset its tab.
Extract that into a pure function and test it (matches the `lib/field-intel.ts` +
`test/field-intel.test.ts` convention).

**Files:**
- Create: `apps/web/src/lib/selected-bracket-logic.ts`
- Test: `apps/web/test/selected-bracket-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/selected-bracket-logic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextBracketKey } from "@/lib/selected-bracket-logic";

describe("nextBracketKey", () => {
  const keys = ["mens-40", "womens-35"];

  it("adopts the shared selection when Bracket & Results has that event", () => {
    expect(nextBracketKey("womens-35", keys, "mens-40")).toBe("womens-35");
  });

  it("keeps the current tab when the shared selection is an FI-only event", () => {
    expect(nextBracketKey("seniors-30", keys, "mens-40")).toBe("mens-40");
  });

  it("keeps the current tab when nothing is selected yet", () => {
    expect(nextBracketKey(null, keys, "mens-40")).toBe("mens-40");
  });

  it("keeps the current tab when the selection is already the current one", () => {
    expect(nextBracketKey("mens-40", keys, "mens-40")).toBe("mens-40");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/selected-bracket-logic.test.ts`
Expected: FAIL — cannot resolve `@/lib/selected-bracket-logic` / `nextBracketKey is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/selected-bracket-logic.ts`:

```ts
/**
 * Pure helpers for the shared bracket selection synced between the Field
 * Intelligence and Bracket & Results sections of the tournament detail page.
 */

/**
 * The tab Bracket & Results should show given the shared selection.
 *
 * Bracket & Results only contains the events that have match data — a subset of
 * all events. It adopts the shared `selectedEventId` only when that event is one
 * it actually has; otherwise it keeps its current tab, so selecting an
 * FI-only bracket in Field Intelligence never resets the Bracket & Results tab.
 */
export function nextBracketKey(
  selectedEventId: string | null,
  eventKeys: string[],
  currentKey: string,
): string {
  if (selectedEventId != null && eventKeys.includes(selectedEventId)) {
    return selectedEventId;
  }
  return currentKey;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/selected-bracket-logic.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/selected-bracket-logic.ts apps/web/test/selected-bracket-logic.test.ts
git commit -m "feat: pure nextBracketKey helper for synced bracket selection"
```

---

### Task 2: Selected-bracket context provider + hook

**Files:**
- Create: `apps/web/src/components/selected-bracket-context.tsx`

- [ ] **Step 1: Write the provider and hook**

Create `apps/web/src/components/selected-bracket-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface SelectedBracketValue {
  /** The event id currently selected in either section, or null on first load. */
  selectedEventId: string | null;
  /** Select from Field Intelligence: set selection and, when that event has a
   *  bracket in Bracket & Results, smooth-scroll down to it. */
  selectFromFieldIntel: (id: string) => void;
  /** Select from Bracket & Results: set selection only; no scroll (the user is
   *  already looking at this section). */
  selectFromBracket: (id: string) => void;
}

const SelectedBracketContext = createContext<SelectedBracketValue | null>(null);

export function SelectedBracketProvider({
  bracketEventIds,
  children,
}: {
  /** Event ids that appear in Bracket & Results (events that have match data). */
  bracketEventIds: string[];
  children: ReactNode;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const bracketIds = useMemo(() => new Set(bracketEventIds), [bracketEventIds]);

  const value = useMemo<SelectedBracketValue>(
    () => ({
      selectedEventId,
      selectFromFieldIntel: (id: string) => {
        setSelectedEventId(id);
        if (bracketIds.has(id)) {
          document
            .getElementById("bracket-results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
      selectFromBracket: (id: string) => setSelectedEventId(id),
    }),
    [selectedEventId, bracketIds],
  );

  return (
    <SelectedBracketContext.Provider value={value}>
      {children}
    </SelectedBracketContext.Provider>
  );
}

export function useSelectedBracket(): SelectedBracketValue {
  const ctx = useContext(SelectedBracketContext);
  if (!ctx) {
    throw new Error(
      "useSelectedBracket must be used within a SelectedBracketProvider",
    );
  }
  return ctx;
}
```

- [ ] **Step 2: Type-check it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors (the provider is not yet consumed, but must type-check).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/selected-bracket-context.tsx
git commit -m "feat: SelectedBracketProvider context for synced bracket selection"
```

---

### Task 3: Wrap the page grid + tag the bracket section

**Files:**
- Modify: `apps/web/src/app/[city]/tournaments/[id]/page.tsx`

- [ ] **Step 1: Import the provider**

In `apps/web/src/app/[city]/tournaments/[id]/page.tsx`, add to the imports block
(after the `LiveBracket` import on line 8):

```tsx
import { SelectedBracketProvider } from "@/components/selected-bracket-context";
```

- [ ] **Step 2: Compute the bracket event ids**

Immediately after the `matches` are fetched and `tournament` null-check
(`if (!tournament) notFound();` near line 87), add:

```tsx
  // Event ids that have a bracket in Bracket & Results — drives the
  // Field-Intelligence → Bracket scroll/sync.
  const bracketEventIds = Array.from(
    new Set(matches.map((m) => m.event_id).filter((id): id is string => id != null)),
  );
```

- [ ] **Step 3: Wrap the grid with the provider**

Find the grid container (line 184):

```tsx
        <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-x-8">
```

Wrap it in the provider. Change the opening so it reads:

```tsx
        <SelectedBracketProvider bracketEventIds={bracketEventIds}>
        <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-x-8">
```

Then find the matching closing `</div>` of that grid (line 221, the `</div>`
immediately before the comment `{/* The quiet "keep exploring" zone ... */}`) and
add the provider close after it:

```tsx
        </div>
        </SelectedBracketProvider>
```

- [ ] **Step 4: Tag the Bracket & Results section as the scroll target**

Find the bracket section (lines 210-214):

```tsx
          {matches.length > 0 && (
            <section className="mt-6 lg:col-start-2 lg:row-start-3 lg:mt-8">
              <LiveBracket matches={matches} events={events} />
            </section>
          )}
```

Change the `<section>` to add the id and scroll margin:

```tsx
          {matches.length > 0 && (
            <section
              id="bracket-results"
              className="mt-6 scroll-mt-20 lg:col-start-2 lg:row-start-3 lg:mt-8"
            >
              <LiveBracket matches={matches} events={events} />
            </section>
          )}
```

- [ ] **Step 5: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors. (`m.event_id` is `string | null` on `TournamentMatch`, so the
type guard narrows correctly.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[city]/tournaments/[id]/page.tsx
git commit -m "feat: wrap tournament grid in SelectedBracketProvider, tag bracket section"
```

---

### Task 4: Wire Field Intelligence to the shared selection

**Files:**
- Modify: `apps/web/src/components/event-breakdown.tsx`

- [ ] **Step 1: Import the hook and drop local state**

In `apps/web/src/components/event-breakdown.tsx`, replace the React import on
line 3:

```tsx
import { useState } from "react";
```

with:

```tsx
import { useSelectedBracket } from "@/components/selected-bracket-context";
```

- [ ] **Step 2: Read selection from context**

In the `EventBreakdown` component body, replace these lines (73-79):

```tsx
export function EventBreakdown({ events }: { events: TournamentEvent[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (events.length === 0) return null;

  const orderedEvents = [...events].sort(standardEventOrder);
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? orderedEvents[0];
```

with:

```tsx
export function EventBreakdown({ events }: { events: TournamentEvent[] }) {
  const { selectedEventId, selectFromFieldIntel } = useSelectedBracket();

  if (events.length === 0) return null;

  const orderedEvents = [...events].sort(standardEventOrder);
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? orderedEvents[0];
```

- [ ] **Step 3: Update the desktop list click handler**

Find the desktop list button's `onClick` (line 124):

```tsx
                    onClick={() => setSelectedEventId(event.id)}
```

Replace with:

```tsx
                    onClick={() => selectFromFieldIntel(event.id)}
```

Note: `isSelected` (line 115) still reads `event.id === selectedEventId`, which now
comes from context — the existing emerald highlight needs no change.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors. Confirm no remaining references to `setSelectedEventId` or
`useState` in this file:

Run: `grep -nE "setSelectedEventId|useState" apps/web/src/components/event-breakdown.tsx`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/event-breakdown.tsx
git commit -m "feat: drive Field Intelligence selection from shared context"
```

---

### Task 5: Wire Bracket & Results to the shared selection

Bracket & Results keeps a local tab (`localKey`) so FI-only selections don't reset
it, syncing from the shared selection only via `nextBracketKey`.

**Files:**
- Modify: `apps/web/src/components/live-bracket.tsx`

- [ ] **Step 1: Update imports**

In `apps/web/src/components/live-bracket.tsx`, replace the React import on line 7:

```tsx
import { useState } from "react";
```

with:

```tsx
import { useEffect, useState } from "react";
import { useSelectedBracket } from "@/components/selected-bracket-context";
import { nextBracketKey } from "@/lib/selected-bracket-logic";
```

- [ ] **Step 2: Sync local tab from shared selection**

In the `LiveBracket` component, find lines 341-343:

```tsx
  const grouped = groupByEventId(matches, events);
  const eventKeys = Array.from(grouped.keys());
  const [selectedEvent, setSelectedEvent] = useState(eventKeys[0]);
```

Replace with:

```tsx
  const grouped = groupByEventId(matches, events);
  const eventKeys = Array.from(grouped.keys());
  const { selectedEventId, selectFromBracket } = useSelectedBracket();
  const [selectedEvent, setSelectedEvent] = useState(eventKeys[0]);

  // Follow the shared selection, but only when it's a bracket we actually have —
  // selecting an FI-only bracket must not reset this tab.
  useEffect(() => {
    setSelectedEvent((current) => nextBracketKey(selectedEventId, eventKeys, current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);
```

- [ ] **Step 3: Update the tab click handler to broadcast**

Find the tab button `onClick` (line 368):

```tsx
                onClick={() => setSelectedEvent(key)}
```

Replace with:

```tsx
                onClick={() => {
                  setSelectedEvent(key);
                  selectFromBracket(key);
                }}
```

- [ ] **Step 4: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full unit-test suite**

Run: `cd apps/web && npm test`
Expected: all suites pass, including `test/selected-bracket-logic.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/live-bracket.tsx
git commit -m "feat: sync Bracket & Results tab with shared bracket selection"
```

---

### Task 6: Verify in the running app

The provider/component wiring is not covered by the node-environment unit tests, so
verify the interaction in the browser (per the project's show-don't-tell rule).
Pick a tournament that has **both** a multi-bracket Field Intelligence list and
match data in Bracket & Results (i.e. `matches.length > 0` with at least 2 events,
and at least one event that has matches).

- [ ] **Step 1: Build to confirm no production-build errors**

Run: `npm run build:web`
Expected: build succeeds (no type or lint errors).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev:web`
Expected: server starts; note the printed port (e.g. `http://localhost:3000`).

- [ ] **Step 3: Manually verify on a desktop-width viewport**

Open a tournament detail page with both sections populated. Confirm:

1. Clicking a bracket in Field Intelligence that **has** matches → the Bracket &
   Results tab switches to it (emerald pill) AND the page smooth-scrolls down to
   Bracket & Results.
2. Clicking a bracket in Field Intelligence that has **no** matches → Field
   Intelligence updates, Bracket & Results tab is unchanged, no scroll.
3. Clicking a tab in Bracket & Results → the Field Intelligence detail switches to
   that bracket (emerald list row), and the page does **not** scroll.
4. Mobile width: Bracket & Results tabs still work; Field Intelligence cards behave
   as before (no regression).

- [ ] **Step 4: Capture a screenshot/recording for review**

Take a screenshot (or short recording) showing a synced selection in both sections
and share it for review.

- [ ] **Step 5: Final state check**

Run: `git status` and `git log --oneline -6`
Expected: clean working tree; six feature commits present (Tasks 1-5 plus this
plan's spec commit already on the branch).
```

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
  initialEventId = null,
  children,
}: {
  /** Event ids that appear in Bracket & Results (events that have match data). */
  bracketEventIds: string[];
  /** Pre-selected bracket (from a shared ?bracket= link), already validated. */
  initialEventId?: string | null;
  children: ReactNode;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
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

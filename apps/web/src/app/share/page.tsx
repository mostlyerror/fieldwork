import type { Metadata } from "next";
import { ResultComposer } from "./result-composer";

export const metadata: Metadata = {
  title: "Make a result card — PickleRadar",
  description: "Turn your tournament podium photo into a shareable result card for Instagram, iMessage, and group chats.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PLACEMENTS = new Set(["gold", "silver", "bronze", "fourth", "finalist"]);

export default async function SharePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const placement = one(sp.placement);

  // Optional prefill via query params — lets result pages deep-link later.
  const initial = {
    placement: placement && PLACEMENTS.has(placement) ? (placement as "gold") : undefined,
    doubles: one(sp.doubles) === undefined ? undefined : one(sp.doubles) !== "0",
    event: one(sp.event),
    p1: one(sp.p1),
    r1: one(sp.r1),
    p2: one(sp.p2),
    r2: one(sp.r2),
    venue: one(sp.venue),
    date: one(sp.date),
  };
  // Drop undefined keys so DEFAULTS win where nothing was passed.
  const cleaned = Object.fromEntries(Object.entries(initial).filter(([, v]) => v !== undefined));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="t-label mb-2 text-emerald-700">Share your win</p>
        <h1 className="t-h1 text-foreground">Make a result card</h1>
        <p className="mt-3 text-foreground/70">
          Drop in your podium photo, set the result, and post it to your story. Everything is editable — fill it in
          right after you win, even before the official results are posted.
        </p>
      </header>
      <ResultComposer initial={cleaned} />
    </main>
  );
}

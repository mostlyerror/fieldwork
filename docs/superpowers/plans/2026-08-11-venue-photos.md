# Venue Photo Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the already-stored venue photos on the venue page (photo hero), a new `/[city]/venues` index page, and a venue-mode OG image; merge the duplicated "Casa Pickle - Space City" venue in prod.

**Architecture:** Read-only feature over `venues.photo_url` (populated at ingest since June — no new Places spend, no schema changes). Pure aggregation/formatting logic lives in a new `lib/venue-stats.ts` (unit-testable without Supabase, matching the repo's pure-logic test pattern in `apps/web/test/`). Pages are server components with ISR. The OG route gains a `?venue=<slug>` mode alongside the existing tournament modes.

**Tech Stack:** Next.js App Router (RSC + ISR), Supabase JS, Tailwind (project `t-*` type roles + `shadow-card` tokens — no ad-hoc `text-[Npx]`), satori via `next/og` + sharp/mozjpeg for OG, vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-venue-photos-design.md`

## Global Constraints

- Zero PBB footprint: photos are Places-sourced, already mirrored in the `venue-photos` Supabase bucket — never hotlink Google.
- No new Places API spend; read `venues.photo_url` only. No new columns, no scraper changes.
- Mobile-first (~360px); warm editorial design language v2: card-overlaps-hero, quiet one-liners, `t-*` roles, `shadow-card`.
- Places attribution: hero and OG carry a small "Photo · Google" credit; index thumbnails exempt.
- OG output: satori PNG → `sharp().jpeg({ quality: 80, mozjpeg: true })`, must stay under 300KB; share crawlers must never get a 500 (degrade to branded no-photo card).
- Photos render via plain `<img>` (repo convention — no `next/image`, `eslint-disable-next-line @next/next/no-img-element` where needed).
- Tests: `cd apps/web && npm test` (vitest, pure-logic tests in `apps/web/test/`). Repo uses npm workspaces.
- Commit after each task (pre-launch cadence: commit + push per batch).

---

### Task 1: Venue stats lib + `getVenuesWithStats` query

**Files:**
- Create: `apps/web/src/lib/venue-stats.ts`
- Test: `apps/web/test/venue-stats.test.ts`
- Modify: `apps/web/src/lib/queries.ts` (append after `getVenuesForSitemap`, ~line 890)

**Interfaces:**
- Consumes: `Venue` from `@/lib/types` (has `slug`, `name`, `photo_url`, `formatted_address`, `city_slug`).
- Produces:
  - `interface VenueCardModel { id: string; slug: string; name: string; photoUrl: string | null; shortCity: string | null; total: number; upcomingCount: number; nextDate: string | null }`
  - `shortCity(formattedAddress: string | null): string | null`
  - `buildVenueCards(venues, tournaments, today): VenueCardModel[]` (types below)
  - `cadenceLine(m: Pick<VenueCardModel, "total" | "upcomingCount">): string`
  - `venueOgLine(total: number, nextDate: string | null): string`
  - `shortDate(iso: string): string` → `"Aug 12"`
  - `getVenuesWithStats(citySlug: string): Promise<VenueCardModel[]>` in `queries.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/venue-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  shortCity,
  shortDate,
  buildVenueCards,
  cadenceLine,
  venueOgLine,
} from "@/lib/venue-stats";

const venue = (id: string, name: string, extra: Partial<{ photo_url: string | null; formatted_address: string | null }> = {}) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  photo_url: extra.photo_url ?? null,
  formatted_address: extra.formatted_address ?? null,
});

const t = (venue_id: string, date_start: string, date_end: string | null = null) => ({
  venue_id,
  date_start,
  date_end,
});

describe("shortCity", () => {
  it("extracts 'City, ST' from a Google formatted_address", () => {
    expect(shortCity("1331 Hwy 6, Sugar Land, TX 77478, USA")).toBe("Sugar Land, TX");
  });
  it("handles addresses without a street part", () => {
    expect(shortCity("Katy, TX 77449, USA")).toBe("Katy, TX");
  });
  it("returns null for null or unparseable input", () => {
    expect(shortCity(null)).toBeNull();
    expect(shortCity("Texas")).toBeNull();
  });
});

describe("shortDate", () => {
  it("formats an ISO date as 'Mon D'", () => {
    expect(shortDate("2026-08-12")).toBe("Aug 12");
  });
});

describe("buildVenueCards", () => {
  const today = "2026-08-11";
  const venues = [venue("a", "Quiet Club"), venue("b", "Busy Club"), venue("c", "No Tournaments Club")];
  const tournaments = [
    t("a", "2026-05-01"),
    t("b", "2026-06-01"),
    t("b", "2026-07-01", "2026-07-02"),
    t("b", "2026-08-15"),
    t("b", "2026-09-01"),
  ];

  it("aggregates totals, upcoming count, and next date per venue", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    const busy = cards.find((c) => c.id === "b")!;
    expect(busy.total).toBe(4);
    expect(busy.upcomingCount).toBe(2);
    expect(busy.nextDate).toBe("2026-08-15");
  });

  it("treats a tournament still running today (date_end >= today) as upcoming", () => {
    const cards = buildVenueCards([venue("x", "Live")], [t("x", "2026-08-10", "2026-08-11")], today);
    expect(cards[0].upcomingCount).toBe(1);
    expect(cards[0].nextDate).toBe("2026-08-10");
  });

  it("sorts by upcoming desc, then total desc, then name asc", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("drops venues with zero linked tournaments", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.find((c) => c.id === "c")).toBeUndefined();
  });

  it("keeps venues without photos (photoUrl null)", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.find((c) => c.id === "a")!.photoUrl).toBeNull();
  });
});

describe("cadenceLine", () => {
  it("shows upcoming when present", () => {
    expect(cadenceLine({ total: 9, upcomingCount: 4 })).toBe("9 tournaments · 4 upcoming");
  });
  it("falls back to hosted-only copy", () => {
    expect(cadenceLine({ total: 2, upcomingCount: 0 })).toBe("2 tournaments hosted");
  });
  it("singularizes", () => {
    expect(cadenceLine({ total: 1, upcomingCount: 0 })).toBe("1 tournament hosted");
  });
});

describe("venueOgLine", () => {
  it("includes next date when present", () => {
    expect(venueOgLine(9, "2026-08-12")).toBe("9 tournaments hosted · Next on Aug 12");
  });
  it("omits next date when null", () => {
    expect(venueOgLine(2, null)).toBe("2 tournaments hosted");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/venue-stats.test.ts`
Expected: FAIL — cannot resolve `@/lib/venue-stats`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/venue-stats.ts`:

```ts
/** Pure aggregation/formatting for venue cards — no Supabase, unit-testable. */

export interface VenueCardModel {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  shortCity: string | null;
  total: number;
  upcomingCount: number;
  nextDate: string | null; // ISO date of the next upcoming tournament
}

interface VenueInput {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  formatted_address: string | null;
}

interface TournamentInput {
  venue_id: string | null;
  date_start: string;
  date_end: string | null;
}

/** "1331 Hwy 6, Sugar Land, TX 77478, USA" → "Sugar Land, TX" */
export function shortCity(formattedAddress: string | null): string | null {
  if (!formattedAddress) return null;
  const parts = formattedAddress.split(",").map((p) => p.trim());
  // Google format ends [..., City, "ST ZIP", Country]; city is 3rd from last.
  if (parts.length < 3) return null;
  const city = parts[parts.length - 3];
  const state = parts[parts.length - 2].split(" ")[0];
  if (!city || !state) return null;
  return `${city}, ${state}`;
}

/** "2026-08-12" → "Aug 12" */
export function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function buildVenueCards(
  venues: VenueInput[],
  tournaments: TournamentInput[],
  today: string,
): VenueCardModel[] {
  const stats = new Map<string, { total: number; upcoming: string[] }>();
  for (const t of tournaments) {
    if (!t.venue_id) continue;
    const s = stats.get(t.venue_id) ?? { total: 0, upcoming: [] };
    s.total++;
    // Same still-upcoming rule as getVenueTournaments: live until date_end passes.
    if ((t.date_end ?? t.date_start) >= today) s.upcoming.push(t.date_start);
    stats.set(t.venue_id, s);
  }

  return venues
    .map((v) => {
      const s = stats.get(v.id);
      if (!s) return null;
      s.upcoming.sort();
      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        photoUrl: v.photo_url,
        shortCity: shortCity(v.formatted_address),
        total: s.total,
        upcomingCount: s.upcoming.length,
        nextDate: s.upcoming[0] ?? null,
      };
    })
    .filter((c): c is VenueCardModel => c !== null)
    .sort(
      (a, b) =>
        b.upcomingCount - a.upcomingCount ||
        b.total - a.total ||
        a.name.localeCompare(b.name),
    );
}

/** Index-card one-liner: "9 tournaments · 4 upcoming" / "2 tournaments hosted" */
export function cadenceLine(m: Pick<VenueCardModel, "total" | "upcomingCount">): string {
  const noun = m.total === 1 ? "tournament" : "tournaments";
  if (m.upcomingCount > 0) return `${m.total} ${noun} · ${m.upcomingCount} upcoming`;
  return `${m.total} ${noun} hosted`;
}

/** OG-card line: "9 tournaments hosted · Next on Aug 12" */
export function venueOgLine(total: number, nextDate: string | null): string {
  const base = `${total} ${total === 1 ? "tournament" : "tournaments"} hosted`;
  return nextDate ? `${base} · Next on ${shortDate(nextDate)}` : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/venue-stats.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Add the query**

In `apps/web/src/lib/queries.ts`, append after `getVenuesForSitemap` (end of file):

```ts
export async function getVenuesWithStats(
  citySlug: string,
): Promise<import("./venue-stats").VenueCardModel[]> {
  const { buildVenueCards } = await import("./venue-stats");
  const today = new Date().toISOString().split("T")[0];
  try {
    const [{ data: venues, error: vErr }, { data: tournaments, error: tErr }] =
      await Promise.all([
        supabase
          .from("venues")
          .select("id, slug, name, photo_url, formatted_address")
          .eq("city_slug", citySlug),
        supabase
          .from("tournaments")
          .select("venue_id, date_start, date_end")
          .eq("status", "active")
          .not("venue_id", "is", null),
      ]);
    if (vErr || tErr || !venues) return [];
    return buildVenueCards(venues, tournaments ?? [], today);
  } catch {
    return [];
  }
}
```

- [ ] **Step 6: Full suite + typecheck**

Run: `cd apps/web && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/venue-stats.ts apps/web/test/venue-stats.test.ts apps/web/src/lib/queries.ts
git commit -m "feat(venues): venue card stats lib + getVenuesWithStats query"
```

---

### Task 2: Venue page photo hero

**Files:**
- Create: `apps/web/src/components/venue-hero.tsx`
- Modify: `apps/web/src/app/[city]/venues/[slug]/page.tsx`

**Interfaces:**
- Consumes: `Venue` (`photo_url`, `name`), `RadarMarkIcon` from `@/components/icons`, `BackLink` from `@/components/back-link`.
- Produces: `<VenueHero photoUrl={string | null} venueName={string} backHref={string} backLabel={string} />` — full-bleed hero with photo or branded fallback, floating back pill, Google credit.

- [ ] **Step 1: Create the hero component**

Create `apps/web/src/components/venue-hero.tsx`:

```tsx
import { BackLink } from "./back-link";
import { RadarMarkIcon } from "./icons";

/**
 * Full-bleed venue photo hero with floating back pill and Places attribution.
 * No photo → branded radar fallback (mirrors tournament-detail's HeroFallback),
 * so the layout is identical either way.
 */
export function VenueHero({
  photoUrl,
  venueName,
  backHref,
  backLabel,
}: {
  photoUrl: string | null;
  venueName: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="relative -mx-3 aspect-[4/3] overflow-hidden bg-emerald-900 sm:-mx-5 sm:aspect-[5/2] sm:rounded-2xl lg:mx-0 lg:aspect-[21/9] lg:rounded-3xl">
      {photoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={venueName} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/0 to-black/25" />
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/75 backdrop-blur-sm">
            Photo · Google
          </span>
        </>
      ) : (
        <HeroFallback venueName={venueName} />
      )}
      <BackLink
        fallbackHref={backHref}
        fallbackLabel={backLabel}
        className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 text-[13px] font-bold text-gray-900 backdrop-blur hover:bg-white"
      />
    </div>
  );
}

function HeroFallback({ venueName }: { venueName: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(120%_130%_at_80%_10%,#0a7d5a,#064c39_72%)]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#fff" strokeOpacity="0.11" strokeWidth="1.4">
          <circle cx="320" cy="26" r="70" />
          <circle cx="320" cy="26" r="130" />
          <circle cx="320" cy="26" r="190" />
        </g>
        <path d="M320 26 L190 26 A130 130 0 0 1 320 -104 Z" fill="#d4af37" fillOpacity="0.08" />
      </svg>
      <RadarMarkIcon className="absolute left-5 top-1/2 h-11 w-11 -translate-y-1/2 text-white/90" />
      <span className="sr-only">{venueName}</span>
    </div>
  );
}
```

Before writing, check `apps/web/src/components/back-link.tsx`: it must accept `className` (the venue page already passes one today, so it does) and render an anchor/button we can absolutely position. If BackLink renders its own "←" arrow text, keep its content as-is — only the pill styling comes from the className above.

- [ ] **Step 2: Rework the venue page layout**

In `apps/web/src/app/[city]/venues/[slug]/page.tsx`, replace the body of the returned JSX (lines 85–140, the `<div className="min-h-screen bg-background">` block) with:

```tsx
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServerHeader city={city} />
      <main className="mx-auto max-w-6xl px-3 sm:px-5 pb-10 pt-4 sm:pt-6">
        <VenueHero
          photoUrl={venue.photo_url}
          venueName={venue.name}
          backHref={`/${citySlug}/venues`}
          backLabel="Venues"
        />

        {/* Header card overlapping the hero (design language v2) */}
        <header className="relative z-10 -mt-14 mx-1 mb-8 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:mx-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="t-h1 text-gray-900">{venue.name}</h1>
              {venue.formatted_address && <p className="mt-1 text-gray-500">{venue.formatted_address}</p>}
              <p className="mt-2 t-body text-gray-600">{cadence}</p>
            </div>
            <FavoriteButton
              compact
              item={{
                kind: "venue",
                id: slug,
                href: `/${citySlug}/venues/${slug}`,
                title: venue.name,
                subtitle: venue.formatted_address ?? null,
                meta: null,
              }}
            />
          </div>
        </header>

        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 t-h2 font-bold text-gray-800">Upcoming at {venue.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 t-h2 font-bold text-gray-800">Past Tournaments</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((t) => <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />)}
            </div>
          </section>
        )}

        {venue.latitude != null && venue.longitude != null && (
          <section>
            <h2 className="mb-4 t-h2 font-bold text-gray-800">Where it is</h2>
            <div className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card">
              <MiniMap latitude={venue.latitude} longitude={venue.longitude} />
            </div>
          </section>
        )}
      </main>
      <Footer citySlug={citySlug} />
    </div>
  );
```

Update imports: add `import { VenueHero } from "@/components/venue-hero";`, remove the now-unused `BackLink` import (it moved into VenueHero). Everything above the return (data fetching, `cadence`, `jsonLd`) is unchanged.

Note the back target is now `/${citySlug}/venues` — the index page ships in Task 3; that's fine within the same push (commit both before deploying, or accept a brief 404 on a pre-launch site).

- [ ] **Step 3: Verify visually (usability gate)**

Run: `cd apps/web && npm run dev` (the repo's dev script bakes `--max-http-header-size=65536`; if running the web app directly use `npm run dev:web` from the repo root — check root `package.json` scripts).
Open `http://localhost:3000/houston/venues/life-time-sugar-land` (confirm the slug via `getVenuesForSitemap` output or the sitemap at `/sitemap.xml`).
Check at 360px width and desktop: photo hero renders, back pill floats top-left, "Photo · Google" credit bottom-right, header card overlaps, map sits at the bottom under "Where it is". Screenshot both widths for the PR/turn summary.

- [ ] **Step 4: Suite + typecheck, commit**

Run: `cd apps/web && npm test && npx tsc --noEmit`
Expected: green.

```bash
git add apps/web/src/components/venue-hero.tsx "apps/web/src/app/[city]/venues/[slug]/page.tsx"
git commit -m "feat(venues): photo hero with overlapping header card on venue pages"
```

---

### Task 3: `/[city]/venues` index page + entry links + sitemap

**Files:**
- Create: `apps/web/src/app/[city]/venues/page.tsx`
- Create: `apps/web/src/components/venue-card.tsx`
- Modify: `apps/web/src/app/sitemap.ts` (after venue entries, ~line 40)
- Modify: `apps/web/src/app/[city]/page.tsx` (subtitle block, ~line 147)
- Modify: `apps/web/src/components/footer.tsx` (link list, ~line 28)

**Interfaces:**
- Consumes: `getVenuesWithStats(citySlug)` and `VenueCardModel` (Task 1), `cadenceLine`, `shortDate` from `@/lib/venue-stats`, `getCityBySlug` from `@/lib/cities`, `RadarMarkIcon`.
- Produces: `<VenueCard venue={VenueCardModel} citySlug={string} />`; route `/{city}/venues`.

- [ ] **Step 1: Create the venue card component**

Create `apps/web/src/components/venue-card.tsx`:

```tsx
import Link from "next/link";
import type { VenueCardModel } from "@/lib/venue-stats";
import { cadenceLine, shortDate } from "@/lib/venue-stats";
import { RadarMarkIcon } from "./icons";

export function VenueCard({ venue: v, citySlug }: { venue: VenueCardModel; citySlug: string }) {
  const hasUpcoming = v.upcomingCount > 0;
  return (
    <Link
      href={`/${citySlug}/venues/${v.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover motion-reduce:hover:transform-none"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-emerald-900">
        {v.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.photoUrl}
              alt={v.name}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/20" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_130%_at_80%_10%,#0a7d5a,#064c39_72%)]">
            <RadarMarkIcon className="h-9 w-9 text-white/80" />
            <span className="t-label text-white/80">{v.name}</span>
          </div>
        )}
        {hasUpcoming && v.nextDate && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-gray-900 backdrop-blur">
            <span className="font-extrabold text-emerald-700">Next</span>
            {shortDate(v.nextDate)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-extrabold leading-snug tracking-[-0.015em] text-gray-900">{v.name}</h3>
        {v.shortCity && <p className="t-small mt-0.5 text-gray-500">{v.shortCity}</p>}
        <p className="t-small mt-2 flex items-center gap-2 font-semibold text-gray-700">
          <span
            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
              hasUpcoming ? "bg-emerald-500 ring-[3px] ring-emerald-100" : "bg-gray-400 ring-[3px] ring-gray-100"
            }`}
          />
          {cadenceLine(v)}
        </p>
      </div>
    </Link>
  );
}
```

(The 17px title is intentional — between `t-h2` 20px and `t-body` 15px for a dense card grid; if a `t-*` role at 17px exists by then, use it instead.)

- [ ] **Step 2: Create the index page**

Create `apps/web/src/app/[city]/venues/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVenuesWithStats } from "@/lib/queries";
import { getCityBySlug } from "@/lib/cities";
import { VenueCard } from "@/components/venue-card";
import { ServerHeader } from "@/components/server-header";
import { Footer } from "@/components/footer";

export const revalidate = 600;

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);
  const cityName = city?.name ?? "Houston";
  const title = `Pickleball Venues in ${cityName} — PickleRadar`;
  const description = `Every venue hosting pickleball tournaments in ${cityName}: photos, upcoming events, and tournament history.`;
  const url = `https://pickleradar.app/${citySlug}/venues`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: "PickleRadar" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function VenuesIndexPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) notFound();

  const venues = await getVenuesWithStats(citySlug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Pickleball venues in ${city.name}`,
    itemListElement: venues.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.name,
      url: `https://pickleradar.app/${citySlug}/venues/${v.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServerHeader city={city} />
      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-10">
        <header className="mb-6">
          <p className="t-label mb-2 text-emerald-700">{city.name}</p>
          <h1 className="t-h1 text-gray-900">Pickleball venues</h1>
          <p className="mt-2 t-body text-gray-500">
            {venues.length > 0
              ? `${venues.length} venue${venues.length === 1 ? "" : "s"} hosting tournaments across greater ${city.name}.`
              : "No venues on record yet."}
          </p>
        </header>
        {venues.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.id} venue={v} citySlug={citySlug} />
            ))}
          </div>
        )}
      </main>
      <Footer citySlug={citySlug} />
    </div>
  );
}
```

- [ ] **Step 3: Sitemap entry**

In `apps/web/src/app/sitemap.ts`, after the venue detail entries are built from `getVenuesForSitemap()` (~line 40), add one index entry per distinct city:

```ts
  const venueCitySlugs = [...new Set(venues.map((v) => v.city_slug).filter((c): c is string => !!c))];
  const venueIndexEntries: MetadataRoute.Sitemap = venueCitySlugs.map((c) => ({
    url: `${baseUrl}/${c}/venues`,
    changeFrequency: "daily",
    priority: 0.7,
  }));
```

and include `...venueIndexEntries` in the returned array (match the file's existing spread/return shape and `changeFrequency`/`priority` house style — mirror whatever the venue detail entries use).

- [ ] **Step 4: Entry links**

City page — in `apps/web/src/app/[city]/page.tsx`, find the subtitle paragraph that renders `… ${upcomingCount} upcoming across ${venueCount} venues.` (~line 147). Immediately after that paragraph (same parent block), add:

```tsx
<Link href={`/${city.slug}/venues`} className="t-small mt-1 inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800">
  Browse venues →
</Link>
```

(Add `import Link from "next/link";` if the file doesn't already import it. If `city.slug` isn't in scope under that name, use the page's existing city-slug variable.)

Footer — in `apps/web/src/components/footer.tsx`, the link list (~line 28) has a Browse link using `browseHref` and a `/submit` link. Between them add:

```tsx
<Link href={`${browseHref}/venues`} className="text-gray-600 hover:text-emerald-700">
  Venues
</Link>
```

First check how `browseHref` is built — if it's already `/{citySlug}` this yields `/{citySlug}/venues`; if it's `/` (no city), point at `/houston/venues`.

- [ ] **Step 5: Verify visually (usability gate)**

With the dev server running, open `http://localhost:3000/houston/venues` at 360px and desktop:
- Cards sorted with most upcoming activity first; "Next Aug 12"-style pills only on venues with upcoming tournaments; gray-dot cadence on inactive venues; any photo-less venue shows the branded fallback block.
- Click through a card → venue page; venue page back pill → returns to the index.
- City page shows "Browse venues →"; footer shows "Venues".
Screenshot mobile + desktop.

- [ ] **Step 6: Suite + typecheck, commit**

Run: `cd apps/web && npm test && npx tsc --noEmit`
Expected: green.

```bash
git add "apps/web/src/app/[city]/venues/page.tsx" apps/web/src/components/venue-card.tsx apps/web/src/app/sitemap.ts "apps/web/src/app/[city]/page.tsx" apps/web/src/components/footer.tsx
git commit -m "feat(venues): /[city]/venues index page with photo cards, sitemap + entry links"
```

---

### Task 4: Venue OG mode on `/api/og`

**Files:**
- Modify: `apps/web/src/app/api/og/route.tsx`
- Modify: `apps/web/src/app/[city]/venues/[slug]/page.tsx` (`generateMetadata`, lines 19–35)

**Interfaces:**
- Consumes: `venueOgLine` from `@/lib/venue-stats` (Task 1), existing `logoMark(size)`, font setup, sharp pipeline in the route.
- Produces: `GET /api/og?venue=<slug>` → 1200×630 JPEG. Photo variant when `photo_url` set; branded dark variant otherwise. Unknown slug → 404. Query param contract used by the venue page metadata.

- [ ] **Step 1: Add venue data fetch + styles to the OG route**

In `apps/web/src/app/api/og/route.tsx`, add after `fetchData` (~line 213):

```tsx
interface VenueOgData {
  name: string;
  photoUrl: string | null;
  citySlug: string;
  cadence: string; // "9 tournaments hosted · Next on Aug 12"
}

async function fetchVenueData(slug: string): Promise<VenueOgData | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, photo_url, city_slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!venue) return null;

  const today = new Date().toISOString().split("T")[0];
  const { data: ts } = await supabase
    .from("tournaments")
    .select("date_start, date_end")
    .eq("venue_id", venue.id)
    .eq("status", "active")
    .order("date_start", { ascending: true });
  const rows = ts ?? [];
  const next = rows.find((t) => ((t.date_end as string | null) ?? (t.date_start as string)) >= today);
  const { venueOgLine } = await import("@/lib/venue-stats");
  return {
    name: venue.name as string,
    photoUrl: venue.photo_url as string | null,
    citySlug: ((venue.city_slug as string | null) ?? "houston").toUpperCase(),
    cadence: venueOgLine(rows.length, (next?.date_start as string | undefined) ?? null),
  };
}

// VENUE — photo full-bleed with bottom scrim; branded dark fallback without a photo.
function Style_venue({ v }: { v: VenueOgData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: "Jakarta", color: "#FFFDF7", position: "relative", background: "#0c1109" }}>
      {v.photoUrl ? (
        <img src={v.photoUrl} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", objectFit: "cover" }} />
      ) : (
        <img src={logoMark(560)} width={560} height={560} alt="" style={{ position: "absolute", top: "40px", right: "-140px", opacity: 0.08 }} />
      )}
      {v.photoUrl && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", display: "flex", background: "linear-gradient(180deg, rgba(2,24,16,0.30) 0%, rgba(2,24,16,0.10) 40%, rgba(2,24,16,0.62) 72%, rgba(2,24,16,0.92) 100%)" }} />
      )}
      {/* Brand top-left */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "absolute", top: "48px", left: "60px" }}>
        <img src={logoMark(36)} width={36} height={36} alt="" />
        <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
      </div>
      {v.photoUrl && (
        <div style={{ display: "flex", position: "absolute", top: "52px", right: "60px", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.35)", padding: "6px 14px", borderRadius: "999px" }}>Photo · Google</div>
      )}
      {/* Bottom block */}
      <div style={{ display: "flex", flexDirection: "column", padding: "0 60px 56px" }}>
        <div style={{ display: "flex", fontSize: "22px", fontWeight: 700, letterSpacing: "6px", color: "#9af5c8", marginBottom: "14px" }}>
          PICKLEBALL VENUE · {v.citySlug}
        </div>
        <div style={{ display: "flex", fontSize: headlineSize(v.name), fontWeight: 800, color: "#FFFDF7", lineHeight: 0.98, letterSpacing: "-2px", maxWidth: "1080px" }}>{v.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px" }}>
          <div style={{ display: "flex", fontSize: "27px", fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>{v.cadence}</div>
          <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: "#9af5c8" }}>pickleradar.app</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the param into GET**

In the `GET` handler, immediately after `const bracketId = searchParams.get("bracket");` (~line 508), add:

```tsx
  const venueSlug = searchParams.get("venue");
  if (venueSlug) {
    const v = await fetchVenueData(venueSlug);
    if (!v) return new Response("Not found", { status: 404 });
    const [semiBold, bold, extraBold] = await Promise.all([fontSemiBold, fontBold, fontExtraBold]);
    const png = new ImageResponse(<Style_venue v={v} />, {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Jakarta", data: semiBold, weight: 600, style: "normal" },
        { name: "Jakarta", data: bold, weight: 700, style: "normal" },
        { name: "Jakarta", data: extraBold, weight: 800, style: "normal" },
      ],
    });
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }
```

(The existing `if (!id)` check stays below — a request with neither `venue` nor `id` still 400s.)

If a photo URL turns out to be broken, satori throws on the unfetchable `<img>`; wrap the venue `ImageResponse` construction in try/catch and on failure re-render `<Style_venue v={{ ...v, photoUrl: null }} />` — the branded fallback — so crawlers never see a 500:

```tsx
    let png: ImageResponse;
    try {
      png = new ImageResponse(<Style_venue v={v} />, imageOpts);
    } catch {
      png = new ImageResponse(<Style_venue v={{ ...v, photoUrl: null }} />, imageOpts);
    }
```

(Factor `imageOpts` = the `{ width, height, fonts }` object above so it's built once.)

- [ ] **Step 3: Point venue page metadata at it**

In `apps/web/src/app/[city]/venues/[slug]/page.tsx` `generateMetadata`, add the image to both blocks:

```ts
  const ogImage = `https://pickleradar.app/api/og?venue=${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: "PickleRadar", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
```

- [ ] **Step 4: Verify output**

With the dev server running:

```bash
curl -s -o /tmp/venue-og.jpg -w "%{http_code} %{content_type}\n" "http://localhost:3000/api/og?venue=life-time-sugar-land"
ls -l /tmp/venue-og.jpg   # expect image/jpeg, well under 300000 bytes
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/og?venue=does-not-exist"   # expect 404
```

Open `/tmp/venue-og.jpg` and eyeball it (photo, scrim, eyebrow, name, cadence, wordmark, credit). Also fetch one venue that exercises the no-photo branch if any exists post-Task-5 (or temporarily hit `?venue=<slug>` after nulling `photoUrl` in a local edit — revert after checking).

- [ ] **Step 5: Suite + typecheck, commit**

Run: `cd apps/web && npm test && npx tsc --noEmit`
Expected: green.

```bash
git add apps/web/src/app/api/og/route.tsx "apps/web/src/app/[city]/venues/[slug]/page.tsx"
git commit -m "feat(og): venue-mode share card (photo hero + branded fallback)"
```

---

### Task 5: Merge the duplicated "Casa Pickle - Space City" venue (prod)

Prod has two `venues` rows named "Casa Pickle - Space City"; one has a photo, one doesn't (the photo-less one is the only venue without a photo — merging fixes both problems). Repoint tournaments to the photo-bearing row, delete the orphan, resync the denormalized photo column.

**Files:**
- Create: `packages/scrapers/src/merge-duplicate-venue.ts`

**Interfaces:**
- Consumes: `supabase` client from `packages/scrapers/src/utils/supabase.js` (same import style as `backfill-venue-photos.ts`); `sync_tournament_venue_photos` RPC (migration 026).
- Produces: one-off CLI — `npx tsx packages/scrapers/src/merge-duplicate-venue.ts "<venue name>"` with `--apply` to execute (dry-run by default).

- [ ] **Step 1: Write the script**

Create `packages/scrapers/src/merge-duplicate-venue.ts`:

```ts
/**
 * One-off: merge duplicate venue rows sharing a display name. Keeps the row
 * with a photo (or the oldest), repoints tournaments, deletes the orphan(s),
 * then resyncs tournaments.venue_photo_url. Dry-run unless --apply.
 *
 *   npx tsx packages/scrapers/src/merge-duplicate-venue.ts "Casa Pickle - Space City" --apply
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { supabase } from "./utils/supabase.js";

async function main() {
  const name = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!name) {
    console.error("Usage: merge-duplicate-venue.ts <venue name> [--apply]");
    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from("venues")
    .select("id, name, slug, place_id, dedup_key, photo_url, created_at")
    .eq("name", name)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length < 2) {
    console.log(`Found ${rows?.length ?? 0} row(s) for "${name}" — nothing to merge.`);
    return;
  }

  // Keeper: prefer the row with a photo; tie-break oldest.
  const keeper = rows.find((r) => r.photo_url) ?? rows[0];
  const orphans = rows.filter((r) => r.id !== keeper.id);
  console.log("KEEPER:", JSON.stringify(keeper, null, 2));
  for (const o of orphans) console.log("ORPHAN:", JSON.stringify(o, null, 2));

  for (const o of orphans) {
    const { count } = await supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", o.id);
    console.log(`Orphan ${o.id} (${o.slug}) has ${count ?? 0} tournament(s) to repoint.`);
    if (!apply) continue;

    const { error: upErr } = await supabase
      .from("tournaments")
      .update({ venue_id: keeper.id })
      .eq("venue_id", o.id);
    if (upErr) throw new Error(`repoint failed: ${upErr.message}`);

    const { error: delErr } = await supabase.from("venues").delete().eq("id", o.id);
    if (delErr) throw new Error(`delete failed: ${delErr.message}`);
    console.log(`Merged ${o.id} into ${keeper.id}.`);
  }

  if (apply) {
    const { error: syncErr } = await supabase.rpc("sync_tournament_venue_photos");
    if (syncErr) throw new Error(`photo sync failed: ${syncErr.message}`);
    console.log("Resynced tournaments.venue_photo_url.");
  } else {
    console.log("Dry run — re-run with --apply to execute.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Before running, open `packages/scrapers/src/utils/supabase.ts` to confirm which env var names it reads, and confirm the RPC name with `grep -n "sync_tournament_venue_photos" supabase/migrations/026_venue_photos.sql`. `packages/scrapers/.env` does NOT contain Supabase creds locally — pass them inline from `apps/web/.env.local` values when running (`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ...`).

- [ ] **Step 2: Dry-run against prod**

Run: `npx tsx packages/scrapers/src/merge-duplicate-venue.ts "Casa Pickle - Space City"` (with env vars set).
Expected: prints exactly 2 rows — keeper has `photo_url`, orphan doesn't. Record both rows' JSON in the session log. **Compare the two rows' `place_id`/`dedup_key`: if the orphan's `place_id` is non-null and different from the keeper's, the next scrape could re-create it — note this in the output and mention it to the user, but proceed (the resolver's 35m same-building merge should now catch it; if it recurs, that's a resolver bug to fix separately).**

- [ ] **Step 3: Apply**

Run again with `--apply`. Expected output: repoint count logged, merge line, photo resync line.

- [ ] **Step 4: Verify prod state**

Re-query venues (script from the session scratchpad, or a quick REST/`supabase` query): expect **31 venues, 31 with photos**, and the venue page `/houston/venues/<keeper slug>` shows the merged tournament history.

- [ ] **Step 5: Commit**

```bash
git add packages/scrapers/src/merge-duplicate-venue.ts
git commit -m "chore(venues): one-off duplicate-venue merge script (Casa Pickle dedup)"
```

---

### Task 6: Final sweep

- [ ] **Step 1: Full suite + typecheck + lint**

Run: `cd apps/web && npm test && npx tsc --noEmit && npx next lint` (skip lint if the repo has no lint script — check `apps/web/package.json`).

- [ ] **Step 2: Walk the loop as a user (usability gate)**

Dev server at 360px: city page → "Browse venues →" → index (photos, pills, cadence) → venue page (hero, overlap card, map at bottom) → back pill → index. Then `curl` the venue OG and confirm it in an [OG preview](https://www.opengraph.xyz/) mentally or via the raw image. Screenshots for the summary.

- [ ] **Step 3: Push**

```bash
git push
```

Vercel deploys from main. Spot-check prod `/houston/venues` and one venue OG URL after deploy.

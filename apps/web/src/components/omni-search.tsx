"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { OmniResults } from "@/lib/queries";

const EMPTY: OmniResults = { players: [], tournaments: [], venues: [] };

const shortDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function PersonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true"><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}
function TrophyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v3" /></svg>;
}
function PinIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 pb-1 pt-2 t-label text-gray-400">{label}</p>
      {children}
    </div>
  );
}

function ResultRow({
  href,
  onNavigate,
  title,
  subtitle,
  meta,
  icon,
}: {
  href: string;
  onNavigate: () => void;
  title: string;
  subtitle: string | null;
  meta: string | null;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-emerald-50/60">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate t-body font-semibold text-gray-900">{title}</span>
        {subtitle && <span className="block truncate t-caption text-gray-400">{subtitle}</span>}
      </span>
      {meta && <span className="shrink-0 t-small font-bold tabular-nums text-emerald-800">{meta}</span>}
    </Link>
  );
}

export function OmniSearch({ citySlug }: { citySlug: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<OmniResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    setQ("");
    setRes(EMPTY);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = (await r.json()) as OmniResults;
        if (!cancelled) setRes(data);
      } catch {
        if (!cancelled) setRes(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  const total = res.players.length + res.tournaments.length + res.venues.length;
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 t-small text-gray-400 transition hover:border-gray-300 hover:text-gray-600"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search players, tournaments…</span>
        <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-semibold text-gray-400 md:inline">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-gray-100 px-4">
              <SearchIcon className="h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search players, tournaments, venues…"
                className="w-full bg-transparent py-3.5 t-body text-gray-900 outline-none placeholder:text-gray-400"
              />
              {loading && (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" aria-hidden />
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-8 text-center t-small text-gray-400">Type at least 2 characters…</p>
              ) : !loading && total === 0 ? (
                <p className="px-4 py-8 text-center t-small text-gray-400">No matches for &ldquo;{q.trim()}&rdquo;.</p>
              ) : (
                <div className="py-2">
                  {res.players.length > 0 && (
                    <Group label="Players">
                      {res.players.map((p) => (
                        <ResultRow key={p.id} href={`/players/${p.id}`} onNavigate={close} title={p.name} subtitle={p.location} meta={p.doubles != null ? p.doubles.toFixed(2) : null} icon={<PersonIcon />} />
                      ))}
                    </Group>
                  )}
                  {res.tournaments.length > 0 && (
                    <Group label="Tournaments">
                      {res.tournaments.map((t) => (
                        <ResultRow key={t.id} href={`/${citySlug}/tournaments/${t.id}`} onNavigate={close} title={t.name} subtitle={t.venue} meta={shortDate(t.dateStart)} icon={<TrophyIcon />} />
                      ))}
                    </Group>
                  )}
                  {res.venues.length > 0 && (
                    <Group label="Venues">
                      {res.venues.map((v) => (
                        <ResultRow key={v.slug} href={`/${citySlug}/venues/${v.slug}`} onNavigate={close} title={v.name} subtitle={v.address} meta={null} icon={<PinIcon />} />
                      ))}
                    </Group>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

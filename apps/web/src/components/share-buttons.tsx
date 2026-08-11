"use client";

import { useState, useRef, useEffect } from "react";
import { track } from "@/lib/analytics";
import { buildShareUrl, type ShareMedium } from "@/lib/share-url";

/** Bracket-scoped share payload — set when the user has a bracket selected, so
 *  the share carries that bracket's URL, card, and stats instead of the
 *  tournament-wide ones. */
export interface ShareBracket {
  id: string;
  name: string;
  registered?: number;
  avgDupr?: number | null;
  overCap?: number;
}

export interface ShareButtonsProps {
  tournamentId: string;
  tournamentName?: string;
  dateRange?: string;
  venue?: string;
  registered?: number;
  eventCount?: number;
  sandbaggerAlert?: boolean;
  liveRatings?: number;
  bracket?: ShareBracket | null;
}

function buildShareText({
  tournamentName,
  dateRange,
  venue,
  registered,
  eventCount,
  sandbaggerAlert,
  liveRatings,
  bracket,
  url,
}: ShareButtonsProps & { url: string }): string {
  const lines: string[] = [];

  if (tournamentName) {
    lines.push(bracket ? `🏓 ${tournamentName} — ${bracket.name}` : `🏓 ${tournamentName}`);
  } else if (bracket) {
    lines.push(`🏓 ${bracket.name}`);
  }

  const dateVenueParts: string[] = [];
  if (dateRange) dateVenueParts.push(dateRange);
  if (venue) dateVenueParts.push(venue);
  if (dateVenueParts.length > 0) {
    lines.push(`📅 ${dateVenueParts.join(" · ")}`);
  }

  if (bracket) {
    // Bracket mode: this bracket's field, not the tournament totals.
    const parts: string[] = [];
    if ((bracket.registered ?? 0) > 0) parts.push(`${bracket.registered} registered`);
    if (bracket.avgDupr != null) parts.push(`avg DUPR ${bracket.avgDupr.toFixed(2)}`);
    if (parts.length > 0) lines.push(`👥 ${parts.join(" · ")}`);
    if ((bracket.overCap ?? 0) > 0) {
      lines.push(`⚠️ ${bracket.overCap} rated over the cap`);
    }
  } else {
    if ((registered ?? 0) > 0 || (eventCount ?? 0) > 0) {
      const parts: string[] = [];
      if ((registered ?? 0) > 0) parts.push(`${registered} registered`);
      if ((eventCount ?? 0) > 0) parts.push(`${eventCount} events`);
      lines.push(`👥 ${parts.join(" across ")}`);
    }

    if (sandbaggerAlert) {
      lines.push(`⚠️ Over-cap field in bracket`);
    }

    if ((liveRatings ?? 0) > 0) {
      lines.push(`📊 ${liveRatings} verified ratings`);
    }
  }

  lines.push("");
  lines.push(`Check it out: ${url}`);

  return lines.join("\n");
}

export function ShareButtons({
  tournamentId,
  tournamentName,
  dateRange,
  venue,
  registered,
  eventCount,
  sandbaggerAlert,
  liveRatings,
  bracket,
}: ShareButtonsProps) {
  const [open, setOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // With a bracket selected the share defaults to that bracket; the dropdown
  // offers a switch back to the whole tournament.
  const [scope, setScope] = useState<"bracket" | "tournament">("bracket");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBracket = scope === "bracket" ? bracket ?? null : null;

  // origin+pathname (not href): an inherited ?bracket= from a shared link must
  // not leak into a tournament-scoped share.
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : `https://pickleradar.app/tournaments/${tournamentId}`;
  const targetUrl = activeBracket
    ? `${baseUrl}?bracket=${encodeURIComponent(activeBracket.id)}`
    : baseUrl;

  // Each share method tags the outbound link with its own utm_medium so we can
  // see in PostHog which method actually drives return visits.
  const shareUrlFor = (medium: ShareMedium) =>
    buildShareUrl(targetUrl, {
      medium,
      campaign: "tournament",
      content: activeBracket ? `${tournamentId}:${activeBracket.id}` : tournamentId,
    });

  const trackProps = {
    tournamentId,
    ...(activeBracket && { bracketId: activeBracket.id }),
  };

  const shareProps: ShareButtonsProps = {
    tournamentId,
    tournamentName,
    dateRange,
    venue,
    registered,
    eventCount,
    sandbaggerAlert,
    liveRatings,
    bracket: activeBracket,
  };

  // Preview shows the copy-text variant (the primary CTA).
  const previewText = buildShareText({
    ...shareProps,
    url: shareUrlFor("copy_text"),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function copyText() {
    track("share_clicked", { method: "copy_text", ...trackProps });
    const text = previewText;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  }

  async function copyLink() {
    track("share_clicked", { method: "copy_link", ...trackProps });
    const link = shareUrlFor("copy_link");
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement("input");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function nativeShare() {
    track("share_clicked", { method: "native_share", ...trackProps });
    if (navigator.share) {
      try {
        await navigator.share({
          title:
            activeBracket && tournamentName
              ? `${tournamentName} — ${activeBracket.name}`
              : tournamentName ?? "Check out this tournament!",
          text: buildShareText({ ...shareProps, url: shareUrlFor("native_share") }),
          url: shareUrlFor("native_share"),
        });
      } catch {
        // User cancelled — do nothing
      }
    } else {
      await copyLink();
    }
  }

  const hasRichData =
    tournamentName || dateRange || venue || registered || eventCount || sandbaggerAlert || liveRatings;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 hover:text-emerald-700 hover:underline"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
        Share
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share this tournament"
          className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-80 sm:w-80 rounded-2xl border border-gray-200/70 bg-white shadow-card p-4"
        >
          <p className="mb-2 t-label font-semibold text-gray-400">
            {activeBracket ? "Share this bracket" : "Share this tournament"}
          </p>

          {bracket && (
            <div className="mb-3 flex rounded-lg bg-gray-100 p-0.5">
              <button
                onClick={() => setScope("bracket")}
                className={`flex-1 truncate rounded-md px-2 py-1 t-caption font-semibold transition ${
                  scope === "bracket" ? "bg-white text-emerald-800 shadow-sm" : "text-gray-500"
                }`}
              >
                {bracket.name}
              </button>
              <button
                onClick={() => setScope("tournament")}
                className={`flex-1 rounded-md px-2 py-1 t-caption font-semibold transition ${
                  scope === "tournament" ? "bg-white text-emerald-800 shadow-sm" : "text-gray-500"
                }`}
              >
                Whole tournament
              </button>
            </div>
          )}

          {hasRichData && (
            <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 t-body font-mono text-gray-700">
              {previewText}
            </pre>
          )}

          <div className="flex flex-col gap-2">
            {hasRichData && (
              <button
                onClick={copyText}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 t-body font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.98]"
              >
                {copiedText ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy text
                  </>
                )}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 t-body font-semibold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
              >
                {copiedLink ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Copy link
                  </>
                )}
              </button>

              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={nativeShare}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 t-body font-semibold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

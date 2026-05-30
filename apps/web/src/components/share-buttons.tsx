"use client";

import { useState, useRef, useEffect } from "react";
import { track } from "@/lib/analytics";
import { buildShareUrl, type ShareMedium } from "@/lib/share-url";

export interface ShareButtonsProps {
  tournamentId: string;
  tournamentName?: string;
  dateRange?: string;
  venue?: string;
  registered?: number;
  eventCount?: number;
  sandbaggerAlert?: boolean;
  liveRatings?: number;
}

function buildShareText({
  tournamentName,
  dateRange,
  venue,
  registered,
  eventCount,
  sandbaggerAlert,
  liveRatings,
  url,
}: ShareButtonsProps & { url: string }): string {
  const lines: string[] = [];

  if (tournamentName) {
    lines.push(`🏓 ${tournamentName}`);
  }

  const dateVenueParts: string[] = [];
  if (dateRange) dateVenueParts.push(dateRange);
  if (venue) dateVenueParts.push(venue);
  if (dateVenueParts.length > 0) {
    lines.push(`📅 ${dateVenueParts.join(" · ")}`);
  }

  if ((registered ?? 0) > 0 || (eventCount ?? 0) > 0) {
    const parts: string[] = [];
    if ((registered ?? 0) > 0) parts.push(`${registered} registered`);
    if ((eventCount ?? 0) > 0) parts.push(`${eventCount} events`);
    lines.push(`👥 ${parts.join(" across ")}`);
  }

  if (sandbaggerAlert) {
    lines.push(`⚠️ Sandbagger alert in bracket`);
  }

  if ((liveRatings ?? 0) > 0) {
    lines.push(`📊 ${liveRatings} verified ratings`);
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
}: ShareButtonsProps) {
  const [open, setOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://pickleradar.app/tournaments/${tournamentId}`;

  // Each share method tags the outbound link with its own utm_medium so we can
  // see in PostHog which method actually drives return visits.
  const shareUrlFor = (medium: ShareMedium) =>
    buildShareUrl(baseUrl, {
      medium,
      campaign: "tournament",
      content: tournamentId,
    });

  const shareProps: ShareButtonsProps = {
    tournamentId,
    tournamentName,
    dateRange,
    venue,
    registered,
    eventCount,
    sandbaggerAlert,
    liveRatings,
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
    track("share_clicked", { method: "copy_text", tournamentId });
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
    track("share_clicked", { method: "copy_link", tournamentId });
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
    track("share_clicked", { method: "native_share", tournamentId });
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournamentName ?? "Check out this tournament!",
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
          className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-80 sm:w-80 rounded-xl border border-gray-200 bg-white shadow-lg p-4"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Share this tournament
          </p>

          {hasRichData && (
            <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm font-mono text-gray-700 leading-relaxed">
              {previewText}
            </pre>
          )}

          <div className="flex flex-col gap-2">
            {hasRichData && (
              <button
                onClick={copyText}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
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
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
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

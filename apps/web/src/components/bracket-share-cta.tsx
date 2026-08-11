"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { buildShareUrl, type ShareMedium } from "@/lib/share-url";
import { eventIntel } from "@/lib/field-intel";
import { effectiveAvgDupr } from "@/lib/dupr-utils";
import { cleanEventName } from "@/lib/event-name";
import type { TournamentEvent } from "@/lib/types";

/** Tournament-level context the CTA needs to compose share text; the page
 *  passes it down since event components don't otherwise see the tournament. */
export interface ShareContext {
  tournamentId: string;
  tournamentName: string;
  dateRange: string;
  venue: string;
}

/** The share moment placed where the intel is: a player looking at their own
 *  bracket's field sends it straight to the bracket's group chat. Native share
 *  sheet where available (mobile), copy-to-clipboard otherwise. */
export function BracketShareCta({
  event,
  share,
}: {
  event: TournamentEvent;
  share: ShareContext;
}) {
  const [copied, setCopied] = useState(false);
  const bracketName = cleanEventName(event);

  function shareText(url: string): string {
    const lines = [`🏓 ${share.tournamentName} — ${bracketName}`];
    const when = [share.dateRange, share.venue].filter(Boolean).join(" · ");
    if (when) lines.push(`📅 ${when}`);
    const stats: string[] = [];
    if (event.registered_count > 0) stats.push(`${event.registered_count} registered`);
    const avg = effectiveAvgDupr(event);
    if (avg != null) stats.push(`avg DUPR ${avg.toFixed(2)}`);
    if (stats.length > 0) lines.push(`👥 ${stats.join(" · ")}`);
    const over = eventIntel(event).above;
    if (over > 0) lines.push(`⚠️ ${over} rated over the cap`);
    lines.push("", `See the full field: ${url}`);
    return lines.join("\n");
  }

  async function onShare() {
    const canNative = typeof navigator !== "undefined" && "share" in navigator;
    const medium: ShareMedium = canNative ? "native_share" : "copy_text";
    track("share_clicked", {
      method: medium,
      tournamentId: share.tournamentId,
      bracketId: event.id,
      surface: "field_intel",
    });
    const url = buildShareUrl(
      `${window.location.origin}${window.location.pathname}?bracket=${encodeURIComponent(event.id)}`,
      { medium, campaign: "tournament", content: `${share.tournamentId}:${event.id}` },
    );
    const text = shareText(url);
    if (canNative) {
      try {
        await navigator.share({
          title: `${share.tournamentName} — ${bracketName}`,
          text,
          url,
        });
      } catch {
        // User dismissed the sheet — do nothing
      }
      return;
    }
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/30 bg-emerald-50 px-4 py-2.5 t-body font-bold text-emerald-800 transition hover:border-emerald-700/60 hover:bg-emerald-100 active:scale-[0.98]"
    >
      {copied ? (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied — paste it in the chat
        </>
      ) : (
        <>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
          Send this bracket to your group chat
        </>
      )}
    </button>
  );
}

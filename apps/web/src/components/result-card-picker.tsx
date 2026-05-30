"use client";

import { useState } from "react";
import { buildShareUrl } from "@/lib/share-url";

const STYLES = [
  { id: "dark", label: "Dark & Bold" },
  { id: "editorial", label: "Clean Editorial" },
  { id: "podium", label: "Podium" },
] as const;

export function ResultCardPicker({
  eventId,
  playerId,
}: {
  eventId: string;
  playerId: string;
}) {
  const [selected, setSelected] = useState<string>("editorial");
  const [copied, setCopied] = useState(false);

  const imageUrl = `/api/result-card?eventId=${eventId}&playerId=${playerId}&style=${selected}`;
  const pageUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://pickleradar.app/results/${eventId}/${playerId}`;

  // The result card is shared as an image; this URL is what carries attribution
  // back. content = the specific result so we can see which one spread.
  const shareUrl = buildShareUrl(pageUrl, {
    medium: "result_card_link",
    campaign: "result_card",
    content: `${eventId}:${playerId}`,
  });

  async function handleDownload() {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pickleradar-result-${selected}.png`;
    a.click();
    URL.revokeObjectURL(url);
    trackPick(selected);
  }

  async function handleShare() {
    trackPick(selected);
    if (navigator.share) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], "pickleradar-result.png", {
          type: "image/png",
        });
        await navigator.share({
          title: "My tournament result — PickleRadar",
          url: shareUrl,
          files: [file],
        });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function trackPick(style: string) {
    fetch("/api/result-card-pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, playerId, style }),
    }).catch(() => {});
  }

  return (
    <div>
      <div className="flex gap-3 mb-6">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-bold transition ${
              selected === s.id
                ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={selected}
          src={imageUrl}
          alt="Result card preview"
          className="w-full"
        />
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 rounded-xl bg-emerald-700 px-6 py-4 text-lg font-bold text-white transition hover:bg-emerald-800"
        >
          Download Image
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-xl border-2 border-emerald-700 px-6 py-4 text-lg font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          {copied ? "Link Copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}

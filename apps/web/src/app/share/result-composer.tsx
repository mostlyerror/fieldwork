"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";

/**
 * The card IS the form. Every value on the card is edited in place
 * (contentEditable spans), placement switches by tapping the medal, format
 * toggles inline, and the photo zone is the uploader. The live card is also the
 * export source — rendered to PNG via html-to-image at 1080×1920, so the photo
 * never leaves the browser. Editing affordances (× / + partner / photo toolbar)
 * are gated behind `exporting` so they never appear in the rendered image.
 */

const CARD_W = 405;
const CARD_H = 720; // 9:16 — exports at 1080×1920 (pixelRatio ≈ 2.667)
const EXPORT_RATIO = 1080 / CARD_W;

type PlacementKey = "gold" | "silver" | "bronze" | "fourth" | "finalist";

const PLACEMENTS: Record<
  PlacementKey,
  { tag: string; grad: string; fg: string; shadow: string; chip: string }
> = {
  gold: { tag: "GOLD · 1st", grad: "linear-gradient(135deg,#f5d77b,#e0a93b)", fg: "#4a2e06", shadow: "rgba(224,169,59,.6)", chip: "#e0a93b" },
  silver: { tag: "SILVER · 2nd", grad: "linear-gradient(135deg,#edeef2,#c2c6cf)", fg: "#3a3d44", shadow: "rgba(180,184,196,.55)", chip: "#c2c6cf" },
  bronze: { tag: "BRONZE · 3rd", grad: "linear-gradient(135deg,#e7bd92,#c07f49)", fg: "#43270a", shadow: "rgba(192,127,73,.55)", chip: "#c07f49" },
  fourth: { tag: "4th Place", grad: "linear-gradient(135deg,#2a3b33,#16241d)", fg: "#cdebd9", shadow: "rgba(8,30,22,.5)", chip: "#2a3b33" },
  finalist: { tag: "FINALIST", grad: "linear-gradient(135deg,#0f9d68,#0a6b48)", fg: "#eafff4", shadow: "rgba(15,157,104,.5)", chip: "#0f9d68" },
};

const PLACEMENT_ORDER: PlacementKey[] = ["gold", "silver", "bronze", "fourth", "finalist"];

type Form = {
  placement: PlacementKey;
  doubles: boolean;
  event: string;
  p1: string;
  r1: string;
  p2: string;
  r2: string;
  venue: string;
  date: string;
};

const DEFAULTS: Form = {
  placement: "gold",
  doubles: true,
  event: "Mixed Doubles · 3.5",
  p1: "Your Name",
  r1: "3.50",
  p2: "Partner",
  r2: "3.50",
  venue: "Tournament · Venue",
  date: "",
};

function MedalIcon({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5 7 22l5-3 5 3-2-7.5" />
    </svg>
  );
}

/**
 * A span you edit in place. Uncontrolled (contentEditable owns the DOM text);
 * we only push `value` back into the node when it changes externally and the
 * field isn't focused — so the caret never jumps mid-type.
 */
function Editable({
  value,
  onChange,
  placeholder,
  style,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  inputMode?: "decimal" | "text";
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      inputMode={inputMode}
      data-placeholder={placeholder}
      className="rc-editable"
      style={{ display: "inline-block", ...style }}
      onInput={(e) => onChange((e.currentTarget.textContent || "").replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    />
  );
}

export function ResultComposer({ initial }: { initial?: Partial<Form> }) {
  const [form, setForm] = useState<Form>({ ...DEFAULTS, ...initial });
  const [photo, setPhoto] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 50, y: 42 }); // object-position %
  const [scale, setScale] = useState(1); // preview fit scale
  const [busy, setBusy] = useState<"none" | "download" | "share">("none");
  const [shareErr, setShareErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false); // hides edit affordances during PNG capture

  const cardRef = useRef<HTMLDivElement>(null);
  const previewColRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Fit the fixed 405px card into the available preview width.
  useEffect(() => {
    const el = previewColRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / CARD_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Data URL (not object URL) so html-to-image can inline it without a fetch.
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setZoom(1);
      setPos({ x: 50, y: 42 });
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  // Drag to reposition the photo (handlers live on the <img>, so they never
  // fight the contentEditable fields layered above it).
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / (CARD_W * scale);
    const dy = (e.clientY - drag.current.y) / (CARD_H * scale);
    drag.current = { x: e.clientX, y: e.clientY };
    setPos((p) => ({
      x: Math.max(0, Math.min(100, p.x - dx * 100)),
      y: Math.max(0, Math.min(100, p.y - dy * 100)),
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const cyclePlacement = () => {
    const i = PLACEMENT_ORDER.indexOf(form.placement);
    set("placement", PLACEMENT_ORDER[(i + 1) % PLACEMENT_ORDER.length]);
  };

  const render = useCallback(async () => {
    const node = cardRef.current;
    if (!node) return null;
    setExporting(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
    // Let the affordance-hiding re-render paint before we capture.
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    try {
      return await toPng(node, { pixelRatio: EXPORT_RATIO, cacheBust: true, width: CARD_W, height: CARD_H, skipFonts: true });
    } finally {
      setExporting(false);
    }
  }, []);

  const onDownload = async () => {
    setBusy("download");
    setShareErr(null);
    try {
      const url = await render();
      if (!url) return;
      const a = document.createElement("a");
      a.download = "pickleradar-result.png";
      a.href = url;
      a.click();
    } catch {
      setShareErr("Could not render the image. Try a different photo.");
    } finally {
      setBusy("none");
    }
  };

  const onShare = async () => {
    setBusy("share");
    setShareErr(null);
    try {
      const url = await render();
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "pickleradar-result.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "My tournament result", text: "pickleradar.app" });
      } else {
        const a = document.createElement("a");
        a.download = "pickleradar-result.png";
        a.href = url;
        a.click();
        setShareErr("Sharing isn't supported on this browser — downloaded instead.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setShareErr("Could not share. The image was rendered but sharing failed.");
    } finally {
      setBusy("none");
    }
  };

  const pl = PLACEMENTS[form.placement];

  return (
    <div className="mx-auto max-w-[440px]">
      {/* One shared file input — driven by the card's photo zone and the Replace chip. */}
      <input id="podium-file" type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div ref={previewColRef} className="w-full">
        <div style={{ height: CARD_H * scale }} className="relative">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CARD_W, height: CARD_H }}>
            {/* ---------- The exported card ---------- */}
            <div
              ref={cardRef}
              style={{
                position: "relative",
                width: CARD_W,
                height: CARD_H,
                borderRadius: 28,
                overflow: "hidden",
                fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif",
                background: "#0b1f17",
                userSelect: "none",
                boxShadow: "0 30px 80px -30px rgba(0,0,0,.6)",
              }}
            >
              {/* photo or empty-state uploader */}
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  draggable={false}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${pos.x}% ${pos.y}%`,
                    transform: `scale(${zoom})`,
                    cursor: "grab",
                    touchAction: "none",
                  }}
                />
              ) : (
                <label
                  htmlFor="podium-file"
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 196, display: "grid", placeItems: "center", cursor: "pointer", color: "rgba(255,255,255,.45)" }}
                >
                  <div style={{ textAlign: "center", padding: 24 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 44, height: 44, margin: "0 auto 12px" }}>
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.8" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>Tap to add your podium photo</div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>JPG or PNG · stays on your device</div>
                  </div>
                </label>
              )}

              {/* scrim */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg,rgba(4,30,22,.55) 0%,rgba(4,30,22,0) 26%,rgba(4,30,22,0) 42%,rgba(4,20,15,.72) 74%,rgba(3,14,10,.94) 100%)" }} />

              {/* top bar */}
              <div style={{ position: "absolute", top: 22, left: 22, right: 22, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 16, letterSpacing: "-.01em" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%,#0a7d5a,#064c39)", display: "grid", placeItems: "center" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#ECFDF3" strokeWidth={1.8} style={{ width: 16, height: 16 }}>
                      <circle cx="12" cy="12" r="7" />
                      <circle cx="12" cy="12" r="2.6" />
                    </svg>
                  </span>
                  PickleRadar
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.82)", background: "rgba(255,255,255,.14)", padding: "6px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.22)" }}>
                  Result
                </div>
              </div>

              {/* medal pill — tap to switch placement */}
              <button
                type="button"
                onClick={cyclePlacement}
                title="Tap to change placement"
                style={{ position: "absolute", left: 24, bottom: 236, display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 16px 9px 11px", border: "none", borderRadius: 999, background: pl.grad, boxShadow: `0 10px 30px -8px ${pl.shadow}`, color: pl.fg, fontWeight: 800, fontSize: 15, letterSpacing: ".02em", whiteSpace: "nowrap", cursor: "pointer" }}
              >
                <MedalIcon stroke={pl.fg} />
                {pl.tag}
                {!exporting && (
                  <svg viewBox="0 0 24 24" fill="none" stroke={pl.fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, marginLeft: 1, opacity: 0.7 }}>
                    <path d="M17 4l3 3-3 3" /><path d="M20 7H9a4 4 0 0 0-4 4" />
                    <path d="M7 20l-3-3 3-3" /><path d="M4 17h11a4 4 0 0 0 4-4" />
                  </svg>
                )}
              </button>

              {/* result block — all fields edit in place */}
              <div style={{ position: "absolute", left: 24, right: 24, bottom: 30, color: "#fff" }}>
                <Editable
                  value={form.event}
                  onChange={(v) => set("event", v)}
                  placeholder="Event · Skill"
                  style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#9af5c8", marginBottom: 10 }}
                />
                <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em", display: "flex", flexWrap: "wrap", alignItems: "baseline" }}>
                  <Editable value={form.p1} onChange={(v) => set("p1", v)} placeholder="Your Name" />
                  {form.doubles ? (
                    <>
                      <span style={{ color: "rgba(255,255,255,.55)", margin: "0 8px" }}>&amp;</span>
                      <Editable value={form.p2} onChange={(v) => set("p2", v)} placeholder="Partner" />
                      {!exporting && (
                        <button type="button" onClick={() => set("doubles", false)} title="Make it singles" style={ghostBtn}>
                          remove
                        </button>
                      )}
                    </>
                  ) : (
                    !exporting && (
                      <button type="button" onClick={() => set("doubles", true)} title="Add a partner" style={{ ...ghostBtn, marginLeft: 10 }}>
                        + partner
                      </button>
                    )
                  )}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <Editable value={form.r1} onChange={(v) => set("r1", v)} placeholder="—" inputMode="decimal" style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{form.p1.split(" ")[0] || "Player"} · DUPR</span>
                  </div>
                  {form.doubles && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <Editable value={form.r2} onChange={(v) => set("r2", v)} placeholder="—" inputMode="decimal" style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{form.p2.split(" ")[0] || "Partner"} · DUPR</span>
                    </div>
                  )}
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,.16)", margin: "18px 0 14px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.92)", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 6px" }}>
                    <Editable value={form.venue} onChange={(v) => set("venue", v)} placeholder="Tournament · Venue" />
                    <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                      <span>—</span>
                      <Editable value={form.date} onChange={(v) => set("date", v)} placeholder="date" style={{ color: "rgba(255,255,255,.7)" }} />
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9af5c8", whiteSpace: "nowrap" }}>pickleradar.app</div>
                </div>
              </div>
            </div>
          </div>

          {/* photo toolbar — overlaid on the card, OUTSIDE the export node */}
          {!exporting && photo && (
            <div
              className="absolute flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-2 py-1.5 backdrop-blur-md"
              style={{ top: 64 * scale, right: 14, color: "#fff" }}
            >
              <label htmlFor="podium-file" className="cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold transition hover:bg-white/15">
                Replace
              </label>
              <span className="h-4 w-px bg-white/25" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 opacity-80"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-emerald-400" aria-label="Zoom photo" />
            </div>
          )}
        </div>
      </div>

      {/* hint */}
      <p className="mt-3 text-center text-xs text-foreground/55">
        Tap any text to edit it · tap the medal to change placement{photo ? " · drag the photo to reposition" : ""}
      </p>

      {/* actions */}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onShare}
          disabled={busy !== "none"}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" /></svg>
          {busy === "share" ? "Rendering…" : "Share"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy !== "none"}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" /></svg>
          {busy === "download" ? "Rendering…" : "Download"}
        </button>
      </div>
      {shareErr && <p className="mt-3 text-center text-sm text-amber-700">{shareErr}</p>}
      <p className="mt-3 text-center text-xs text-foreground/50">Your photo stays on your device — the card is built right here in your browser and never uploaded.</p>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  marginLeft: 8,
  alignSelf: "center",
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px dashed rgba(255,255,255,.4)",
  background: "transparent",
  color: "rgba(255,255,255,.75)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

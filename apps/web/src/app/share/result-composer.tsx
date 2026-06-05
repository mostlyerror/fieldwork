"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";

/**
 * Client-side result-card composer. The live preview IS the export source
 * (rendered to PNG via html-to-image at 1080×1920), so the user's photo never
 * leaves the browser — no upload, no storage, no cost. Complements the
 * server-rendered /api/result-card (which can't composite a user photo).
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
const PLACEMENT_LABEL: Record<PlacementKey, string> = {
  gold: "1st",
  silver: "2nd",
  bronze: "3rd",
  fourth: "4th",
  finalist: "Finalist",
};

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

export function ResultComposer({ initial }: { initial?: Partial<Form> }) {
  const [form, setForm] = useState<Form>({ ...DEFAULTS, ...initial });
  const [photo, setPhoto] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 50, y: 42 }); // object-position %
  const [scale, setScale] = useState(1); // preview fit scale
  const [busy, setBusy] = useState<"none" | "download" | "share">("none");
  const [shareErr, setShareErr] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const previewColRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Fit the fixed 405px card into the available preview width.
  useEffect(() => {
    const el = previewColRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / CARD_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Read as a data URL (not an object URL) so html-to-image can inline the
    // photo during export without a fetch — blob: URLs fail in the clone step.
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setZoom(1);
      setPos({ x: 50, y: 42 });
    };
    reader.readAsDataURL(file);
  };

  // Pointer drag to reposition the photo (only when a photo is loaded).
  const onPointerDown = (e: React.PointerEvent) => {
    if (!photo) return;
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

  const render = useCallback(async () => {
    const node = cardRef.current;
    if (!node) return null;
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    return toPng(node, { pixelRatio: EXPORT_RATIO, cacheBust: true, width: CARD_W, height: CARD_H, skipFonts: true });
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
      // AbortError = user dismissed the share sheet; not an error.
      if ((err as Error)?.name !== "AbortError") setShareErr("Could not share. The image was rendered but sharing failed.");
    } finally {
      setBusy("none");
    }
  };

  const pl = PLACEMENTS[form.placement];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* ---------- Preview ---------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div ref={previewColRef} className="w-full">
          <div style={{ height: CARD_H * scale }} className="relative">
            <div
              style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CARD_W, height: CARD_H }}
            >
              {/* The exported node */}
              <div
                ref={cardRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                  position: "relative",
                  width: CARD_W,
                  height: CARD_H,
                  borderRadius: 28,
                  overflow: "hidden",
                  fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif",
                  background: "#0b1f17",
                  cursor: photo ? "grab" : "default",
                  userSelect: "none",
                  touchAction: "none",
                  boxShadow: "0 30px 80px -30px rgba(0,0,0,.6)",
                }}
              >
                {/* photo */}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${pos.x}% ${pos.y}%`,
                      transform: `scale(${zoom})`,
                    }}
                  />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.4)" }}>
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 40, height: 40, margin: "0 auto 10px" }}>
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.8" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Add your podium photo</div>
                    </div>
                  </div>
                )}

                {/* scrim */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(4,30,22,.55) 0%,rgba(4,30,22,0) 26%,rgba(4,30,22,0) 42%,rgba(4,20,15,.72) 74%,rgba(3,14,10,.94) 100%)" }} />

                {/* top bar */}
                <div style={{ position: "absolute", top: 22, left: 22, right: 22, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff" }}>
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

                {/* medal pill */}
                <div style={{ position: "absolute", left: 24, bottom: 236, display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 16px 9px 11px", borderRadius: 999, background: pl.grad, boxShadow: `0 10px 30px -8px ${pl.shadow}`, color: pl.fg, fontWeight: 800, fontSize: 15, letterSpacing: ".02em", whiteSpace: "nowrap" }}>
                  <MedalIcon stroke={pl.fg} />
                  {pl.tag}
                </div>

                {/* result block */}
                <div style={{ position: "absolute", left: 24, right: 24, bottom: 30, color: "#fff" }}>
                  {form.event.trim() && (
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#9af5c8", marginBottom: 10 }}>{form.event}</div>
                  )}
                  <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em" }}>
                    {form.doubles && form.p2.trim() ? `${form.p1} & ${form.p2}` : form.p1}
                  </div>
                  {(form.r1.trim() || (form.doubles && form.r2.trim())) && (
                    <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
                      {form.r1.trim() && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{form.r1}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{form.p1.split(" ")[0] || "Player"} · DUPR</span>
                        </div>
                      )}
                      {form.doubles && form.r2.trim() && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{form.r2}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{form.p2.split(" ")[0] || "Partner"} · DUPR</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ height: 1, background: "rgba(255,255,255,.16)", margin: "18px 0 14px" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.92)" }}>
                      {form.venue}
                      {form.date.trim() && <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500 }}> — {form.date}</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9af5c8" }}>pickleradar.app</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* photo controls under the preview */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition active:scale-[0.98]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
            {photo ? "Replace photo" : "Add photo"}
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
          {photo && (
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <span className="font-medium">Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-28 accent-emerald-700" />
            </div>
          )}
        </div>
        {photo && <p className="mt-2 text-xs text-foreground/50">Drag the photo to reposition it.</p>}
      </div>

      {/* ---------- Controls ---------- */}
      <div className="space-y-6">
        <Field label="Placement">
          <div className="flex flex-wrap gap-2">
            {PLACEMENT_ORDER.map((k) => {
              const active = form.placement === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("placement", k)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98] ${active ? "border-transparent text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/30"}`}
                  style={active ? { background: PLACEMENTS[k].chip, color: PLACEMENTS[k].fg } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLACEMENTS[k].chip }} />
                  {PLACEMENT_LABEL[k]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Format">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {[true, false].map((d) => (
              <button
                key={String(d)}
                type="button"
                onClick={() => set("doubles", d)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${form.doubles === d ? "bg-foreground text-background" : "text-foreground/70"}`}
              >
                {d ? "Doubles" : "Singles"}
              </button>
            ))}
          </div>
        </Field>

        <Input label="Event" value={form.event} onChange={(v) => set("event", v)} placeholder="Mixed Doubles · 3.5" />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Input label={form.doubles ? "Your name" : "Name"} value={form.p1} onChange={(v) => set("p1", v)} placeholder="Your Name" />
          <Input label="DUPR" value={form.r1} onChange={(v) => set("r1", v)} placeholder="3.50" className="w-24" inputMode="decimal" />
        </div>

        {form.doubles && (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Input label="Partner" value={form.p2} onChange={(v) => set("p2", v)} placeholder="Partner" />
            <Input label="DUPR" value={form.r2} onChange={(v) => set("r2", v)} placeholder="3.50" className="w-24" inputMode="decimal" />
          </div>
        )}

        <Input label="Tournament · Venue" value={form.venue} onChange={(v) => set("venue", v)} placeholder="Casa Pickle · Galleria" />
        <Input label="Date" value={form.date} onChange={(v) => set("date", v)} placeholder="Jun 7, 2026" />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onShare}
            disabled={busy !== "none"}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M4 12v8h16v-8M12 16V4M8 8l4-4 4 4" /></svg>
            {busy === "share" ? "Rendering…" : "Share"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={busy !== "none"}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" /></svg>
            {busy === "download" ? "Rendering…" : "Download"}
          </button>
        </div>
        {shareErr && <p className="text-sm text-amber-700">{shareErr}</p>}
        <p className="text-xs text-foreground/50">Your photo stays on your device — the card is built right here in your browser and never uploaded.</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{label}</span>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground outline-none transition focus:border-emerald-600 ${className}`}
      />
    </label>
  );
}

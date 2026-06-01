"use client";

import { useMemo, useState } from "react";
import { VenueSearch, type VenueSelection } from "@/components/venue-search";
import { useToast } from "@/components/admin/toast";
import {
  mapExtractionToDraftRow,
  type FlyerExtraction,
  type FlyerDraftRow,
} from "@/lib/flyer-extract";
import { createFlyerDraft, publishFlyerDraft } from "./actions";
import { DUPLICATE_ERROR_PREFIX } from "./dedup";

const CITY_SLUG = "houston"; // only city configured today

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ data: result.split(",")[1], mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FlyerImportForm() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<FlyerDraftRow | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [venue, setVenue] = useState<VenueSelection | null>(null);
  const [venueDefaults, setVenueDefaults] = useState({ name: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the wizard step from real state.
  const step: 1 | 2 | 3 = createdId ? 3 : draft ? 2 : 1;
  const isDuplicate = !!error?.startsWith(DUPLICATE_ERROR_PREFIX);

  function handleFile(f: File | null) {
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function handleExtract() {
    if (file && file.size > 3_000_000) {
      setError("Image must be under 3 MB — please resize before uploading.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const body: { text: string; imageBase64?: string; imageMediaType?: string } = { text };
      if (file) {
        const { data, mediaType } = await fileToBase64(file);
        body.imageBase64 = data;
        body.imageMediaType = mediaType;
      }
      const res = await fetch("/api/flyer-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Extraction failed (${res.status})`);
      }
      const { extraction } = (await res.json()) as { extraction: FlyerExtraction };
      setDraft(mapExtractionToDraftRow(extraction));
      setNotes(extraction.confidenceNotes ?? null);
      setVenueDefaults({
        name: extraction.venueName ?? "",
        address: extraction.venueAddress ?? "",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setExtracting(false);
    }
  }

  function update<K extends keyof FlyerDraftRow>(key: K, value: FlyerDraftRow[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save(ignoreDuplicate: boolean) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const result = await createFlyerDraft({
      draft,
      venue,
      sourceUrl: sourceUrl || null,
      ignoreDuplicate,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      if (!result.error.startsWith(DUPLICATE_ERROR_PREFIX)) toast(result.error, "error");
    } else {
      setCreatedId(result.id);
      setError(null);
      toast("Private draft saved", "success");
    }
  }

  async function handlePublish() {
    if (!createdId) return;
    const result = await publishFlyerDraft(createdId, CITY_SLUG);
    if ("error" in result) {
      setError(result.error);
      toast(result.error, "error");
    } else {
      setPublished(true);
      toast("Published — now live on /" + CITY_SLUG, "success");
    }
  }

  function startOver() {
    setText("");
    handleFile(null);
    setSourceUrl("");
    setDraft(null);
    setNotes(null);
    setVenue(null);
    setVenueDefaults({ name: "", address: "" });
    setCreatedId(null);
    setPublished(false);
    setError(null);
  }

  const privateLink = createdId
    ? `https://pickleradar.app/${CITY_SLUG}/tournaments/${createdId}`
    : "";
  const outreach = createdId
    ? `Hi! I'm building PickleRadar, a free directory of local pickleball tournaments. I made a listing for "${draft?.name}" so players can find it:\n\n${privateLink}\n\nIt's private until you confirm. Want me to publish it? Reply yes and I'll make it live — totally free, and I'll link your registration.`
    : "";

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value).then(
      () => toast(`${label} copied`, "success"),
      () => toast("Copy failed", "error"),
    );
  }

  // Publish-readiness checklist over real state.
  const hasName = !!draft?.name.trim();
  const hasDate = !!draft?.date_start;
  const venueConfirmed = !!venue;

  return (
    <div className="text-emerald-950">
      {/* ── Page header + city pill ── */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 lg:mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-[26px]">
            Flyer Import
          </h1>
          <p className="mt-1.5 max-w-[620px] text-[13px] text-emerald-900/70 lg:text-[13.5px]">
            Paste the post, drop the flyer, let Claude take a first pass — then
            verify against the source, confirm the venue, and ship a private
            draft to the organizer.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900/70 sm:flex">
          <span className="h-[7px] w-[7px] rounded-full bg-emerald-600 shadow-[0_0_0_3px_#ecfdf3]" />
          Houston · only configured city
        </div>
      </div>

      {/* ── Stepper ── */}
      <Stepper step={step} />

      {/* ── Top-level (non-duplicate) error ── */}
      {error && !createdId && !isDuplicate && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ════════════════ STEP 1 — INTAKE ════════════════ */}
      {step === 1 && (
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHead title="Intake" meta="paste · upload · extract" />
            <div className="flex flex-col gap-4 p-[18px]">
              <Field label="Facebook post text">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  className={textareaCls}
                  placeholder="Paste the FB post…"
                />
              </Field>
              <Field label="Flyer image">
                {previewUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Flyer preview"
                      className="h-20 w-16 rounded-lg border border-emerald-900/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleFile(null)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="block text-sm text-emerald-900/70 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700"
                  />
                )}
              </Field>
              <Field label="FB post URL (optional)">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://facebook.com/…"
                />
              </Field>
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || (!text && !file)}
                className={primaryBtnCls + " w-full sm:w-auto"}
              >
                {extracting ? "Extracting…" : "Extract with Claude"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════ STEP 2 + 3 — COCKPIT ════════════════ */}
      {step >= 2 && draft && (
        <div className="lg:grid lg:grid-cols-[minmax(340px,440px)_minmax(520px,1fr)_minmax(360px,500px)] lg:items-start lg:gap-[22px] xl:grid-cols-[minmax(360px,460px)_minmax(560px,1fr)_minmax(380px,520px)]">
          {/* ── LEFT: source (pinned on desktop) ── */}
          <div className="mb-4 lg:sticky lg:top-[68px] lg:mb-0">
            <Card>
              <CardHead title="Source" meta="pinned for review" />
              <div className="flex flex-col p-[18px]">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Flyer"
                    className="w-full rounded-xl border border-emerald-900/10 object-contain"
                  />
                ) : (
                  <div className="grid aspect-[4/5] place-items-center rounded-xl border border-emerald-900/10 bg-emerald-950/95 text-center text-emerald-100">
                    <div className="px-6 text-sm font-semibold text-emerald-200/80">
                      No flyer image uploaded — text-only extraction.
                    </div>
                  </div>
                )}
                <SrcLabel className="mt-4">Post text</SrcLabel>
                <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[10px] border border-emerald-900/[0.06] bg-[#FFFDF7] px-3 py-3 text-[12.5px] leading-relaxed text-emerald-900/70">
                  {text || "— no post text —"}
                </div>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-1.5 break-all text-xs font-semibold text-emerald-700"
                  >
                    🔗 {sourceUrl}
                  </a>
                )}
              </div>
            </Card>
          </div>

          {/* ── CENTER: editable fields + save bar ── */}
          <div className="flex flex-col gap-[18px]">
            {isDuplicate && (
              <div className="flex gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-[12.5px] leading-snug text-orange-900">
                <span className="text-[15px]">⚠️</span>
                <div>
                  <b className="text-orange-700">Possible duplicate.</b> {error}
                </div>
              </div>
            )}

            {/* Editable fields only while still a draft (step 2) */}
            {!createdId && (
              <Card>
                <CardHead
                  title="Extracted fields"
                  meta={notes ? "Claude Sonnet · check flagged" : "Claude Sonnet"}
                />
                <div className="flex flex-col gap-3.5 p-[18px]">
                  <Field
                    label="Name"
                    required
                    chip={{ text: "extracted", tone: "ok" }}
                  >
                    <input
                      className={inputCls}
                      value={draft.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Start date"
                      required
                      chip={notes ? { text: "check this", tone: "check" } : undefined}
                    >
                      <input
                        type="date"
                        className={notes ? inputCls + " " + flagCls : inputCls}
                        value={draft.date_start ?? ""}
                        onChange={(e) => update("date_start", e.target.value || null)}
                      />
                    </Field>
                    <Field label="End date">
                      <input
                        type="date"
                        className={inputCls}
                        value={draft.date_end ?? ""}
                        onChange={(e) => update("date_end", e.target.value || null)}
                      />
                    </Field>
                  </div>

                  {notes && (
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
                      <span className="text-[15px]">📌</span>
                      <div>
                        <b className="text-amber-700">Claude flagged this.</b> {notes}
                      </div>
                    </div>
                  )}

                  <SectLabel>Venue · confirm via Google Places</SectLabel>
                  <VenueSearch
                    defaultName={venueDefaults.name}
                    defaultAddress={venueDefaults.address}
                    onSelect={setVenue}
                    onClear={() => setVenue(null)}
                  />

                  <SectLabel>Pricing</SectLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Entry fee ($)" chip={{ text: "extracted", tone: "ok" }}>
                      <input
                        type="number"
                        className={inputCls}
                        value={draft.entry_fee ?? ""}
                        onChange={(e) =>
                          update("entry_fee", e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </Field>
                    <Field label="Format">
                      <input
                        className={inputCls}
                        value={draft.format ?? ""}
                        onChange={(e) => update("format", e.target.value || null)}
                      />
                    </Field>
                  </div>

                  <SectLabel>Registration</SectLabel>
                  <Field label="Registration URL">
                    <input
                      className={inputCls}
                      value={draft.registration_url ?? ""}
                      onChange={(e) => update("registration_url", e.target.value || null)}
                    />
                  </Field>
                  <Field label="Description / notes">
                    <textarea
                      rows={4}
                      className={textareaCls}
                      value={draft.description ?? ""}
                      onChange={(e) => update("description", e.target.value || null)}
                    />
                  </Field>
                </div>
              </Card>
            )}

            {/* Read-only saved summary at step 3 (center column keeps context) */}
            {createdId && (
              <Card>
                <CardHead title="Saved draft" meta="private · DRAFT" />
                <div className="flex flex-col gap-2.5 p-[18px] text-[13px]">
                  <SummaryRow label="Name" value={draft.name} />
                  <SummaryRow
                    label="Dates"
                    value={
                      draft.date_start
                        ? draft.date_end && draft.date_end !== draft.date_start
                          ? `${draft.date_start} → ${draft.date_end}`
                          : draft.date_start
                        : "—"
                    }
                  />
                  <SummaryRow
                    label="Venue"
                    value={venue?.locationName ?? draft.location_name ?? "TBD"}
                  />
                  <SummaryRow
                    label="Entry fee"
                    value={draft.entry_fee != null ? `$${draft.entry_fee}` : "—"}
                  />
                  <SummaryRow label="Format" value={draft.format ?? "—"} />
                </div>
              </Card>
            )}

            {/* ── Save bar (step 2 only) ── */}
            {!createdId && (
              <div className="lg:sticky lg:bottom-4 flex flex-col gap-3 rounded-2xl border border-emerald-900/10 bg-white/95 p-3.5 shadow-[0_6px_20px_rgba(20,40,30,.07)] backdrop-blur sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-emerald-900/70">
                  <Readiness ok={hasName} label="Name" />
                  <span className="text-emerald-900/20">·</span>
                  <Readiness ok={hasDate} label="Date" />
                  <span className="text-emerald-900/20">·</span>
                  <Readiness ok={venueConfirmed} label="Venue" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
                  {isDuplicate && (
                    <button
                      type="button"
                      onClick={() => save(true)}
                      disabled={saving}
                      className={amberBtnCls}
                    >
                      Save anyway
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => save(false)}
                    disabled={saving || !hasName}
                    className={primaryBtnCls}
                  >
                    {saving ? "Saving…" : "Save private draft"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: publish & outreach (step 3) ── */}
          <div className="mt-4 lg:sticky lg:top-[68px] lg:mt-0 lg:flex lg:flex-col lg:gap-[18px]">
            {createdId ? (
              <>
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 lg:mb-0">
                    {error}
                  </div>
                )}

                <Card>
                  <CardHead title="Step 3 — Publish" meta="draft saved · private" />
                  <div className="flex flex-col gap-4 p-[18px]">
                    <SrcLabel>Ready to publish?</SrcLabel>
                    <div className="flex flex-col gap-3">
                      <ChecklistRow ok={hasName} label="Has a name" sub={draft.name} />
                      <ChecklistRow ok={hasDate} label="Has a date" sub="required to go live" />
                      <ChecklistRow
                        ok={venueConfirmed}
                        label="Venue confirmed"
                        sub={venueConfirmed ? "map pin set" : "optional — publish anytime"}
                      />
                    </div>
                    {published ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                        ✓ Published — now live and listed on /{CITY_SLUG}.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={!hasDate}
                        className={primaryBtnCls + " w-full justify-center"}
                      >
                        🚀 Publish — make it live
                      </button>
                    )}
                    <p className="-mt-1 text-center text-[11.5px] text-emerald-900/50">
                      Flips status DRAFT → ACTIVE and lists it on /{CITY_SLUG}
                    </p>
                  </div>
                </Card>

                <Card>
                  <CardHead title="Organizer outreach" meta="share before going live" />
                  <div className="flex flex-col gap-3.5 p-[18px]">
                    <div>
                      <SrcLabel>Private link · share with organizer</SrcLabel>
                      <div className="mt-2 flex items-center gap-2.5 break-all rounded-[10px] border border-dashed border-emerald-900/15 bg-[#FFFDF7] px-3 py-2.5 text-[12.5px] font-semibold text-emerald-700">
                        <a
                          href={privateLink}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 underline"
                        >
                          {privateLink}
                        </a>
                        <button
                          type="button"
                          onClick={() => copy(privateLink, "Link")}
                          className={copyBtnCls}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <SrcLabel>Outreach template</SrcLabel>
                      <div className="mt-2 whitespace-pre-wrap rounded-[10px] border border-emerald-900/[0.06] bg-[#FFFDF7] p-3 text-[12.5px] leading-relaxed text-emerald-900/70">
                        {outreach}
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(outreach, "Outreach")}
                        className={copyBtnCls + " mt-2"}
                      >
                        📋 Copy outreach
                      </button>
                    </div>
                  </div>
                </Card>

                <button
                  type="button"
                  onClick={startOver}
                  className="rounded-full border border-emerald-900/10 bg-white px-5 py-2 text-sm font-semibold text-emerald-900/70 hover:bg-emerald-50"
                >
                  Import another flyer
                </button>
              </>
            ) : (
              // Step 2 desktop placeholder so the publish column has presence
              <div className="hidden lg:block">
                <Card>
                  <CardHead title="Step 3 — Publish" meta="locked until saved" />
                  <div className="flex flex-col gap-3 p-[18px] opacity-60">
                    <SrcLabel>Ready to publish?</SrcLabel>
                    <div className="flex flex-col gap-3">
                      <ChecklistRow ok={hasName} label="Has a name" sub="required" />
                      <ChecklistRow ok={hasDate} label="Has a date" sub="required to go live" />
                      <ChecklistRow
                        ok={venueConfirmed}
                        label="Venue confirmed"
                        sub="optional"
                      />
                    </div>
                    <p className="text-center text-[11.5px] text-emerald-900/50">
                      Save the private draft to unlock publish &amp; outreach.
                    </p>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── primitives ──────────────────────────── */

const inputCls =
  "w-full rounded-[10px] border border-emerald-900/10 bg-white px-3 py-2.5 text-[13.5px] text-emerald-950 focus:border-emerald-600 focus:outline-none focus:ring-[3px] focus:ring-emerald-50";
const textareaCls = inputCls + " leading-relaxed";
const flagCls = "border-amber-300 bg-[#fffdf6]";

const primaryBtnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45";
const amberBtnCls =
  "inline-flex items-center justify-center rounded-full border-[1.5px] border-amber-300 bg-white px-5 py-2.5 text-[13.5px] font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-45";
const copyBtnCls =
  "shrink-0 rounded-full border border-emerald-900/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-emerald-900/70 hover:bg-emerald-50";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white shadow-[0_1px_2px_rgba(20,40,30,.04)]">
      {children}
    </div>
  );
}

function CardHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-emerald-900/[0.06] px-[18px] py-3.5">
      <h2 className="text-[13.5px] font-extrabold tracking-tight">{title}</h2>
      {meta && <span className="text-[11.5px] font-semibold text-emerald-900/50">{meta}</span>}
    </div>
  );
}

function SrcLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "text-[11px] font-bold uppercase tracking-wider text-emerald-900/50 " + className
      }
    >
      {children}
    </div>
  );
}

function SectLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-900/50">
      <span className="whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-emerald-900/[0.06]" />
    </div>
  );
}

function Field({
  label,
  required,
  chip,
  children,
}: {
  label: string;
  required?: boolean;
  chip?: { text: string; tone: "ok" | "check" };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold text-emerald-900/70">
        {label}
        {required && <span className="font-extrabold text-red-600">*</span>}
        {chip && (
          <span
            className={
              "rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide " +
              (chip.tone === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-amber-200 bg-amber-50 text-amber-700")
            }
          >
            {chip.text}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function Readiness({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-emerald-700" : "text-emerald-900/40"}>
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

function ChecklistRow({ ok, label, sub }: { ok: boolean; label: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] font-semibold">
      <span
        className={
          "grid h-5 w-5 flex-none place-items-center rounded-full text-xs font-extrabold " +
          (ok
            ? "bg-emerald-600 text-white"
            : "border border-amber-200 bg-amber-50 text-amber-600")
        }
      >
        {ok ? "✓" : "!"}
      </span>
      {label}
      <span className="font-medium text-emerald-900/50">{sub}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-semibold text-emerald-900/50">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold text-emerald-950">
        {value}
      </span>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Intake" },
    { n: 2, label: "Review & fix" },
    { n: 3, label: "Publish" },
  ];
  return (
    <div className="mb-5 flex flex-wrap gap-2 lg:mb-[18px] lg:w-fit lg:rounded-full lg:border lg:border-emerald-900/10 lg:bg-white lg:p-1.5 lg:shadow-[0_1px_2px_rgba(20,40,30,.03)]">
      {steps.map(({ n, label }) => {
        const state = n < step ? "done" : n === step ? "active" : "todo";
        return (
          <div
            key={n}
            className={
              "flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[13px] font-bold lg:min-h-0 lg:px-[18px] lg:py-2 " +
              (state === "active"
                ? "border border-emerald-950 bg-emerald-950 text-white"
                : state === "done"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 lg:border-transparent lg:bg-transparent"
                  : "border border-emerald-900/10 bg-white text-emerald-900/50 lg:border-transparent lg:bg-transparent")
            }
          >
            <span
              className={
                "grid h-[22px] w-[22px] place-items-center rounded-full text-[11.5px] lg:h-[21px] lg:w-[21px] " +
                (state === "active"
                  ? "bg-white text-emerald-950"
                  : state === "done"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-900/5 text-emerald-900/50")
              }
            >
              {state === "done" ? "✓" : n}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
}

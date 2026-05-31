"use client";

import { useState } from "react";
import { VenueSearch, type VenueSelection } from "@/components/venue-search";
import {
  mapExtractionToDraftRow,
  type FlyerExtraction,
  type FlyerDraftRow,
} from "@/lib/flyer-extract";
import { createFlyerDraft, publishFlyerDraft } from "./actions";

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
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  function update<K extends keyof FlyerDraftRow>(key: K, value: FlyerDraftRow[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const result = await createFlyerDraft({
      draft,
      venue,
      sourceUrl: sourceUrl || null,
    });
    setSaving(false);
    if ("error" in result) setError(result.error);
    else setCreatedId(result.id);
  }

  async function handlePublish() {
    if (!createdId) return;
    const result = await publishFlyerDraft(createdId, CITY_SLUG);
    if ("error" in result) setError(result.error);
    else setPublished(true);
  }

  const privateLink = createdId
    ? `https://pickleradar.app/${CITY_SLUG}/tournaments/${createdId}`
    : "";
  const outreach = createdId
    ? `Hi! I'm building PickleRadar, a free directory of local pickleball tournaments. I made a listing for "${draft?.name}" so players can find it:\n\n${privateLink}\n\nIt's private until you confirm. Want me to publish it? Reply yes and I'll make it live — totally free, and I'll link your registration.`
    : "";

  return (
    <div className="space-y-6">
      {error && !createdId && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Intake */}
      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <label className="block text-sm font-semibold text-gray-700">
          Facebook post text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          placeholder="Paste the FB post..."
        />
        <label className="block text-sm font-semibold text-gray-700">
          Flyer image
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-gray-600"
        />
        <label className="block text-sm font-semibold text-gray-700">
          FB post URL (optional)
        </label>
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          placeholder="https://facebook.com/..."
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={extracting || (!text && !file)}
          className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {extracting ? "Extracting..." : "Extract"}
        </button>
      </div>

      {/* Editable draft */}
      {draft && !createdId && (
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Double-check:</span> {notes}
            </div>
          )}
          <Field label="Name">
            <input className={inputCls} value={draft.name}
              onChange={(e) => update("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className={inputCls} value={draft.date_start ?? ""}
                onChange={(e) => update("date_start", e.target.value || null)} />
            </Field>
            <Field label="End date">
              <input type="date" className={inputCls} value={draft.date_end ?? ""}
                onChange={(e) => update("date_end", e.target.value || null)} />
            </Field>
          </div>
          <Field label="Venue (confirm via search)">
            <VenueSearch
              defaultName={venueDefaults.name}
              defaultAddress={venueDefaults.address}
              onSelect={setVenue}
              onClear={() => setVenue(null)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry fee ($)">
              <input type="number" className={inputCls} value={draft.entry_fee ?? ""}
                onChange={(e) => update("entry_fee", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Format">
              <input className={inputCls} value={draft.format ?? ""}
                onChange={(e) => update("format", e.target.value || null)} />
            </Field>
          </div>
          <Field label="Registration URL">
            <input className={inputCls} value={draft.registration_url ?? ""}
              onChange={(e) => update("registration_url", e.target.value || null)} />
          </Field>
          <Field label="Description / notes">
            <textarea rows={4} className={inputCls} value={draft.description ?? ""}
              onChange={(e) => update("description", e.target.value || null)} />
          </Field>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
        </div>
      )}

      {/* Post-save: link + outreach + publish */}
      {createdId && (
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-700">Private link</p>
            <a href={privateLink} target="_blank" rel="noreferrer"
              className="break-all text-sm text-green-700 underline">
              {privateLink}
            </a>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Outreach template</p>
            <textarea readOnly rows={6} className={inputCls} value={outreach} />
            <button type="button"
              onClick={() => navigator.clipboard.writeText(outreach)}
              className="mt-2 rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200">
              Copy template
            </button>
          </div>
          {published ? (
            <p className="text-sm font-semibold text-green-700">
              Published — now live and listed.
            </p>
          ) : (
            <button type="button" onClick={handlePublish}
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700">
              Publish
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

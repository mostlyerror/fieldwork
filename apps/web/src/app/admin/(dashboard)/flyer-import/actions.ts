"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { upsertVenueFromSelection, type ConfirmedVenue } from "@/lib/venues";
import { TOURNAMENT_STATUS } from "@/lib/tournament-status";
import type { FlyerDraftRow } from "@/lib/flyer-extract";
import { findFlyerDuplicate, DUPLICATE_ERROR_PREFIX } from "./dedup";

export interface CreateFlyerDraftInput {
  draft: FlyerDraftRow;
  venue: ConfirmedVenue | null;
  sourceUrl: string | null; // the FB post URL, if known
  ignoreDuplicate?: boolean; // set true to save anyway after a warning
}

export async function createFlyerDraft(
  input: CreateFlyerDraftInput,
): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  if (!input.draft.name?.trim()) return { error: "Name is required" };

  const admin = getSupabaseAdmin();

  let venueId: string | null = null;
  let latitude: number | null = input.venue?.latitude ?? null;
  let longitude: number | null = input.venue?.longitude ?? null;
  let locationName = input.venue?.locationName || input.draft.location_name;
  let locationAddress = input.venue?.locationAddress ?? input.draft.location_address;

  if (!input.ignoreDuplicate) {
    const dup = await findFlyerDuplicate(
      admin,
      input.draft.date_start,
      latitude,
      longitude,
    );
    if (dup) {
      return {
        error: `${DUPLICATE_ERROR_PREFIX} of "${dup.name}" (${dup.id}). Re-save with "ignore duplicate" to create anyway.`,
      };
    }
  }

  if (input.venue) {
    venueId = await upsertVenueFromSelection(admin, input.venue);
  }

  const { data: inserted, error } = await admin
    .from("tournaments")
    .insert({
      name: input.draft.name,
      date_start: input.draft.date_start,
      date_end: input.draft.date_end,
      location_name: locationName || "TBD",
      location_address: locationAddress,
      latitude,
      longitude,
      format: input.draft.format,
      entry_fee: input.draft.entry_fee,
      registration_url: input.draft.registration_url,
      registration_status: input.draft.registration_status,
      description: input.draft.description,
      status: TOURNAMENT_STATUS.DRAFT,
      source_platform: "flyer",
      source_url: input.sourceUrl,
      venue_id: venueId,
      is_manually_submitted: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[flyer] create draft failed:", error);
    return { error: error?.message ?? "insert failed" };
  }

  if (input.sourceUrl) {
    const { error: srcError } = await admin.from("tournament_sources").upsert(
      {
        tournament_id: inserted.id,
        source_platform: "flyer",
        source_url: input.sourceUrl,
        registration_url: input.draft.registration_url,
      },
      { onConflict: "tournament_id,source_platform,source_url" },
    );
    if (srcError) console.error("[flyer] source insert failed:", srcError);
  }

  return { id: inserted.id };
}

export async function publishFlyerDraft(
  id: string,
  citySlug: string,
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  const admin = getSupabaseAdmin();

  // Guard: only publish actual drafts, and only when they have a date.
  const { data: row } = await admin
    .from("tournaments")
    .select("date_start, status")
    .eq("id", id)
    .single();
  if (!row) return { error: "Tournament not found" };
  if (row.status !== TOURNAMENT_STATUS.DRAFT)
    return { error: "Cannot publish: tournament is not a draft" };
  if (!row.date_start) return { error: "Cannot publish: missing date" };

  const { error } = await admin
    .from("tournaments")
    .update({ status: TOURNAMENT_STATUS.ACTIVE })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${citySlug}`);
  revalidatePath(`/${citySlug}/tournaments/${id}`);
  return { success: true };
}

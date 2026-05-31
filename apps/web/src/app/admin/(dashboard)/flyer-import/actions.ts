"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { upsertVenueFromSelection, type ConfirmedVenue } from "@/lib/venues";
import { TOURNAMENT_STATUS } from "@/lib/tournament-status";
import type { FlyerDraftRow } from "@/lib/flyer-extract";

export interface CreateFlyerDraftInput {
  draft: FlyerDraftRow;
  venue: ConfirmedVenue | null;
  sourceUrl: string | null; // the FB post URL, if known
}

export async function createFlyerDraft(
  input: CreateFlyerDraftInput,
): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  if (!input.draft.name?.trim()) return { error: "Name is required" };

  const admin = getSupabaseAdmin();

  let venueId: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let locationName = input.draft.location_name;
  let locationAddress = input.draft.location_address;

  if (input.venue) {
    venueId = await upsertVenueFromSelection(admin, input.venue);
    latitude = input.venue.latitude || null;
    longitude = input.venue.longitude || null;
    locationName = input.venue.locationName || locationName;
    locationAddress = input.venue.locationAddress || locationAddress;
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

  return { id: inserted.id };
}

export async function publishFlyerDraft(
  id: string,
  citySlug: string,
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  const admin = getSupabaseAdmin();

  // Guard: never publish without a date (spec edge case).
  const { data: row } = await admin
    .from("tournaments")
    .select("date_start")
    .eq("id", id)
    .single();
  if (!row?.date_start) return { error: "Cannot publish: missing date" };

  const { error } = await admin
    .from("tournaments")
    .update({ status: TOURNAMENT_STATUS.ACTIVE })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${citySlug}`);
  revalidatePath(`/${citySlug}/tournaments/${id}`);
  return { success: true };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPlacePhotoBytes } from "./places-client.js";

export const VENUE_PHOTO_BUCKET = "venue-photos";

/** Create the public photo bucket if it doesn't exist yet (idempotent). */
export async function ensureVenuePhotoBucket(db: SupabaseClient): Promise<void> {
  const { data } = await db.storage.getBucket(VENUE_PHOTO_BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(VENUE_PHOTO_BUCKET, {
    public: true,
  });
  if (error && !/already exists/i.test(error.message)) {
    console.error("[venue-photo] createBucket failed:", error.message);
  }
}

/**
 * Fetch a venue's Google photo ONCE, store it in the public bucket, and write the
 * stored public URL to venues.photo_url. Cost-once-at-ingest: the billed Place
 * Photos request happens here; pages then read the stored URL (never hotlinked,
 * never re-fetched per view). Returns the public URL, or null on any failure.
 */
export async function storeVenuePhoto(
  db: SupabaseClient,
  venueId: string,
  photoName: string,
): Promise<string | null> {
  const photo = await fetchPlacePhotoBytes(photoName, 800);
  if (!photo) return null;

  const ext = photo.contentType.includes("png") ? "png" : "jpg";
  const path = `${venueId}.${ext}`;

  const { error: upErr } = await db.storage
    .from(VENUE_PHOTO_BUCKET)
    .upload(path, photo.bytes, {
      contentType: photo.contentType,
      upsert: true,
    });
  if (upErr) {
    console.error(`[venue-photo] upload failed for ${venueId}:`, upErr.message);
    return null;
  }

  const url = db.storage.from(VENUE_PHOTO_BUCKET).getPublicUrl(path).data
    .publicUrl;

  const { error: updErr } = await db
    .from("venues")
    .update({ photo_url: url })
    .eq("id", venueId);
  if (updErr) {
    console.error(`[venue-photo] venue update failed for ${venueId}:`, updErr.message);
    return null;
  }
  return url;
}

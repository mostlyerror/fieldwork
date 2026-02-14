"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export async function updatePostCaption(postId: string, caption: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("social_posts")
    .update({ caption, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error("Failed to update caption");
  return { success: true };
}

export async function publishPost(postId: string) {
  await requireAdmin();

  const db = getSupabaseAdmin();
  const { data: post, error: fetchErr } = await db
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (fetchErr || !post) throw new Error("Post not found");

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !userId) throw new Error("Instagram not configured");

  try {
    // Step 1: Create media container
    const containerRes = await fetch(`${GRAPH_API}/${userId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: post.image_url,
        caption: post.caption,
        access_token: accessToken,
      }),
    });

    if (!containerRes.ok) {
      const err = await containerRes.text();
      await db
        .from("social_posts")
        .update({
          status: "failed",
          error_message: `Container creation failed: ${err}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
      throw new Error(`Container creation failed: ${err}`);
    }

    const { id: containerId } = (await containerRes.json()) as { id: string };

    // Step 2: Publish
    const publishRes = await fetch(`${GRAPH_API}/${userId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    if (!publishRes.ok) {
      const err = await publishRes.text();
      await db
        .from("social_posts")
        .update({
          status: "failed",
          error_message: `Publish failed: ${err}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
      throw new Error(`Publish failed: ${err}`);
    }

    const { id: mediaId } = (await publishRes.json()) as { id: string };

    await db
      .from("social_posts")
      .update({
        status: "published",
        platform_media_id: mediaId,
        published_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return { success: true, mediaId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from("social_posts")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    throw err;
  }
}

export async function rejectPost(postId: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("social_posts")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error("Failed to reject post");
  return { success: true };
}

export async function retryPost(postId: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin()
    .from("social_posts")
    .update({
      status: "queued",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) throw new Error("Failed to retry post");
  return { success: true };
}

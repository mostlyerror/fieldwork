"use server";

import crypto from "node:crypto";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { nameMatches } from "@/lib/player-linker";
import { posthogServer } from "@/lib/posthog-server";

export interface PlayerCandidate {
  id: string;
  name: string;
  location: string | null;
  dupr_doubles: number | null;
}

export async function searchPlayers(query: string): Promise<PlayerCandidate[]> {
  if (!query || !query.trim()) return [];
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("players")
    .select("id, name, location, dupr_doubles");
  if (!data) return [];

  const matches = data.filter((p) => nameMatches(query, p.name as string));
  return matches.slice(0, 25).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    location: (p.location as string | null) ?? null,
    dupr_doubles: (p.dupr_doubles as number | null) ?? null,
  }));
}

type ClaimResult =
  | { status: "sent" }
  | { status: "no_subscriber" }
  | { status: "already_claimed_by_another" }
  | { status: "error"; message: string };

export async function requestClaim(
  email: string,
  playerId: string,
): Promise<ClaimResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { status: "error", message: "Email is required." };
  }
  if (!playerId) {
    return { status: "error", message: "Pick a player first." };
  }

  const supabase = getSupabaseAdmin();

  const { data: subscriber } = await supabase
    .from("email_subscribers")
    .select("id, name")
    .eq("email", normalizedEmail)
    .eq("status", "active")
    .maybeSingle();

  if (!subscriber) return { status: "no_subscriber" };

  // Check if another active subscriber already claimed this player
  const { data: otherClaim } = await supabase
    .from("email_subscribers")
    .select("id")
    .eq("player_id", playerId)
    .neq("id", subscriber.id)
    .maybeSingle();

  if (otherClaim) return { status: "already_claimed_by_another" };

  const token = crypto.randomBytes(32).toString("base64url");

  const { error } = await supabase.from("player_claims").insert({
    subscriber_id: subscriber.id,
    player_id: playerId,
    token,
  });
  if (error) {
    console.error("Failed to create claim:", error);
    return { status: "error", message: "Couldn't create claim. Try again." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "https://pickleradar.app";
  if (apiKey) {
    try {
      const { data: player } = await supabase
        .from("players")
        .select("name, location, dupr_doubles")
        .eq("id", playerId)
        .single();

      const confirmUrl = `${appUrl}/profile/claim/${token}`;
      const playerLine = player
        ? `${player.name}${player.location ? ` · ${player.location}` : ""}${player.dupr_doubles != null ? ` · ${Number(player.dupr_doubles).toFixed(2)}` : ""}`
        : "this player";

      const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FFFDF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <div style="padding:8px 0 16px">
    <span style="font-size:14px;font-weight:800;color:#065f46;letter-spacing:3px">PICKLERADAR</span>
  </div>
  <h1 style="margin:0 0 12px;color:#0a0a0a;font-size:22px;font-weight:900">Confirm your player profile</h1>
  <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5">
    Someone asked us to link your subscription to:
  </p>
  <div style="background:#fff;border:2px solid #0a0a0a;border-radius:12px;padding:16px 20px;margin-bottom:24px">
    <strong style="color:#0a0a0a;font-size:16px">${escapeHtml(playerLine)}</strong>
  </div>
  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5">
    If that's you, confirm below. If it's not, ignore this email — nothing will happen.
  </p>
  <a href="${confirmUrl}" style="display:inline-block;background:#065f46;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Yes, that's me ↗</a>
  <p style="margin:32px 0 0;color:#9ca3af;font-size:12px">This link expires in 7 days.</p>
</div>
</body></html>`;

      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "PickleRadar <claims@pickleradar.app>",
        to: normalizedEmail,
        subject: "Confirm your PickleRadar player profile",
        html,
      });
    } catch (err) {
      console.error("Failed to send claim email:", err);
    }
  } else {
    console.log(`[claim] Would send confirm email to ${normalizedEmail} for token ${token}`);
  }

  posthogServer?.capture({
    distinctId: subscriber.id,
    event: "player_claim_requested",
    properties: {
      player_id: playerId,
      $set: { email: normalizedEmail },
    },
  });

  return { status: "sent" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

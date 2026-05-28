/**
 * Smart Tournament Alerts
 *
 * For each linked subscriber, score upcoming tournaments and email the
 * highest-scoring one (if it's above threshold and we haven't already
 * alerted on it). One alert per subscriber per week max.
 */

import { Resend } from "resend";
import { supabase } from "./utils/supabase.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { posthog, SCRAPER_ID } from "./utils/posthog.js";

const APP_URL = process.env.APP_URL ?? "https://pickleradar.app";
const SCORE_THRESHOLD = 15;
const COOLDOWN_DAYS = 7;

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  player_id: string;
  dupr_doubles: number | null;
}

interface UpcomingTournament {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  entry_fee: number | null;
  registration_close_date: string | null;
  source_url: string | null;
  events: TournamentEventLite[];
}

interface TournamentEventLite {
  id: string;
  name: string;
  event_type: string | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  player_names: string[];
}

interface Score {
  total: number;
  reasons: string[];
  matchedEventName?: string;
  matchedPartnerName?: string;
}

interface ScoredTournament {
  tournament: UpcomingTournament;
  score: Score;
}

/* ---------- Scoring ---------- */

export function scoreTournament(
  tournament: UpcomingTournament,
  subscriberDupr: number | null,
  pastPartnerNames: Set<string>,
): Score {
  let total = 0;
  const reasons: string[] = [];
  let matchedEventName: string | undefined;
  let matchedPartnerName: string | undefined;

  // 1. Skill match — event whose skill range covers subscriber's DUPR ±0.2
  if (subscriberDupr != null) {
    const fitEvent = tournament.events.find(
      (e) =>
        e.skill_level_min != null &&
        e.skill_level_max != null &&
        subscriberDupr + 0.2 >= e.skill_level_min &&
        subscriberDupr - 0.2 <= e.skill_level_max,
    );
    if (fitEvent) {
      total += 10;
      reasons.push("skill_match");
      matchedEventName = fitEvent.name;
    }
  }

  // 2. Past partner present
  for (const event of tournament.events) {
    for (const pn of event.player_names) {
      const norm = pn.trim().toLowerCase();
      if (pastPartnerNames.has(norm)) {
        total += 15;
        reasons.push("partner_registered");
        matchedPartnerName = pn;
        break;
      }
    }
    if (matchedPartnerName) break;
  }

  // 3. Registration urgency
  if (tournament.registration_close_date) {
    const ms = new Date(tournament.registration_close_date).getTime() - Date.now();
    const days = ms / (1000 * 60 * 60 * 24);
    if (days > 0 && days <= 7) {
      total += 5;
      reasons.push("urgency");
    }
  }

  return { total, reasons, matchedEventName, matchedPartnerName };
}

/* ---------- Data fetchers ---------- */

async function getLinkedSubscribers(): Promise<Subscriber[]> {
  const { data } = await supabase
    .from("email_subscribers")
    .select("id, email, name, player_id, players!email_subscribers_player_id_fkey(dupr_doubles)")
    .eq("status", "active")
    .eq("wants_smart_alerts", true)
    .not("player_id", "is", null);

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => {
    const players = row.players as { dupr_doubles: number | null } | null;
    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string | null,
      player_id: row.player_id as string,
      dupr_doubles: players?.dupr_doubles ?? null,
    };
  });
}

async function getUpcomingTournaments(): Promise<UpcomingTournament[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, date_start, date_end, location_name, entry_fee, registration_close_date, source_url")
    .eq("status", "active")
    .gte("date_end", today);

  if (!tournaments || tournaments.length === 0) return [];

  const tIds = tournaments.map((t) => t.id);
  const { data: events } = await supabase
    .from("tournament_events")
    .select("id, tournament_id, name, event_type, skill_level_min, skill_level_max")
    .in("tournament_id", tIds);

  const eventsByT = new Map<string, TournamentEventLite[]>();
  const eventIds: string[] = [];
  for (const e of events ?? []) {
    eventIds.push(e.id as string);
    const arr = eventsByT.get(e.tournament_id as string) ?? [];
    arr.push({
      id: e.id as string,
      name: e.name as string,
      event_type: e.event_type as string | null,
      skill_level_min: e.skill_level_min as number | null,
      skill_level_max: e.skill_level_max as number | null,
      player_names: [],
    });
    eventsByT.set(e.tournament_id as string, arr);
  }

  // Attach player names per event
  if (eventIds.length > 0) {
    const { data: players } = await supabase
      .from("event_players")
      .select("event_id, player_name, partner_name")
      .in("event_id", eventIds);

    const namesByEvent = new Map<string, string[]>();
    for (const p of players ?? []) {
      const eId = p.event_id as string;
      const arr = namesByEvent.get(eId) ?? [];
      arr.push(p.player_name as string);
      if (p.partner_name) arr.push(p.partner_name as string);
      namesByEvent.set(eId, arr);
    }

    for (const [, evs] of eventsByT) {
      for (const e of evs) {
        e.player_names = namesByEvent.get(e.id) ?? [];
      }
    }
  }

  return tournaments.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    date_start: t.date_start as string,
    date_end: t.date_end as string | null,
    location_name: t.location_name as string,
    entry_fee: t.entry_fee as number | null,
    registration_close_date: t.registration_close_date as string | null,
    source_url: t.source_url as string | null,
    events: eventsByT.get(t.id as string) ?? [],
  }));
}

async function getPastPartnerNames(playerId: string): Promise<Set<string>> {
  // From matches table, find unique names this player has partnered with
  const { data } = await supabase
    .from("matches")
    .select(
      "team1_player1_id, team1_player2_id, team1_player1_name, team1_player2_name, team2_player1_id, team2_player2_id, team2_player1_name, team2_player2_name",
    )
    .or(
      `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`,
    )
    .limit(200);

  const partners = new Set<string>();
  for (const m of data ?? []) {
    let partnerName: string | null = null;
    if (m.team1_player1_id === playerId) partnerName = m.team1_player2_name as string | null;
    else if (m.team1_player2_id === playerId) partnerName = m.team1_player1_name as string | null;
    else if (m.team2_player1_id === playerId) partnerName = m.team2_player2_name as string | null;
    else if (m.team2_player2_id === playerId) partnerName = m.team2_player1_name as string | null;
    if (partnerName) partners.add(partnerName.trim().toLowerCase());
  }
  return partners;
}

async function alreadyAlerted(subscriberId: string, tournamentId: string): Promise<boolean> {
  const { count } = await supabase
    .from("tournament_alerts_sent")
    .select("id", { count: "exact", head: true })
    .eq("subscriber_id", subscriberId)
    .eq("tournament_id", tournamentId);
  return (count ?? 0) > 0;
}

async function recentlyAlerted(subscriberId: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COOLDOWN_DAYS);
  const { count } = await supabase
    .from("tournament_alerts_sent")
    .select("id", { count: "exact", head: true })
    .eq("subscriber_id", subscriberId)
    .gte("sent_at", cutoff.toISOString());
  return (count ?? 0) > 0;
}

/* ---------- Email ---------- */

function buildAlertHtml(
  subscriber: Subscriber,
  t: UpcomingTournament,
  score: Score,
): string {
  const greeting = subscriber.name ? `Hey ${subscriber.name.split(" ")[0]} —` : "Hey —";
  const dateStr = new Date(t.date_start + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const bullets: string[] = [];
  if (score.reasons.includes("skill_match") && score.matchedEventName) {
    bullets.push(
      `<li><strong>Matches your level</strong> — ${escapeHtml(score.matchedEventName)} fits your DUPR.</li>`,
    );
  }
  if (score.reasons.includes("partner_registered") && score.matchedPartnerName) {
    bullets.push(
      `<li><strong>${escapeHtml(score.matchedPartnerName)} is registered</strong> — you've played with them before.</li>`,
    );
  }
  if (score.reasons.includes("urgency") && t.registration_close_date) {
    const days = Math.ceil(
      (new Date(t.registration_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    bullets.push(`<li><strong>Closes in ${days} day${days === 1 ? "" : "s"}</strong> — register soon.</li>`);
  }

  const fee = t.entry_fee != null ? ` &bull; $${t.entry_fee}` : "";
  const detailUrl = `${APP_URL}/houston/tournaments/${t.id}`;
  const unsubToken = Buffer.from(subscriber.email).toString("base64url");
  const unsubUrl = `${APP_URL}/unsubscribe?token=${unsubToken}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#FFFDF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="padding:8px 0 16px">
    <span style="font-size:14px;font-weight:800;color:#065f46;letter-spacing:3px">PICKLERADAR</span>
  </div>

  <p style="margin:0 0 8px;color:#0a0a0a;font-size:16px">${greeting}</p>
  <p style="margin:0 0 24px;color:#374151;font-size:16px">Here's a tournament that looks good for you:</p>

  <div style="background:#fff;border:2px solid #0a0a0a;border-radius:12px;padding:24px;margin-bottom:24px">
    <h1 style="margin:0 0 8px;color:#0a0a0a;font-size:24px;font-weight:900;letter-spacing:-0.5px">${escapeHtml(t.name)}</h1>
    <p style="margin:0 0 16px;color:#065f46;font-size:15px;font-weight:700">${dateStr} &bull; ${escapeHtml(t.location_name)}${fee}</p>

    ${bullets.length > 0 ? `<p style="margin:16px 0 8px;font-size:13px;letter-spacing:2px;font-weight:800;color:#6b7280;text-transform:uppercase">Why it's good for you</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.6">
      ${bullets.join("\n      ")}
    </ul>` : ""}

    <a href="${detailUrl}" style="display:inline-block;background:#065f46;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">See full intel →</a>
  </div>

  <div style="text-align:center;padding:16px 0 0;font-size:12px;color:#9ca3af">
    <p style="margin:0 0 4px">You're getting this because you signed up for PickleRadar.</p>
    <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Main ---------- */

export interface SmartAlertResult {
  subscribersChecked: number;
  alertsSent: number;
  skippedCooldown: number;
}

export interface SmartAlertOptions {
  /** Restrict to a single subscriber email — used for testing before broad rollout. */
  onlyEmail?: string;
  /** Compute everything but don't actually send or record. */
  dryRun?: boolean;
}

export async function sendSmartAlerts(opts: SmartAlertOptions = {}): Promise<SmartAlertResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && !opts.dryRun) {
    console.log("[smart-alerts] No RESEND_API_KEY, skipping");
    return { subscribersChecked: 0, alertsSent: 0, skippedCooldown: 0 };
  }

  const resend = apiKey ? new Resend(apiKey) : null;
  const result: SmartAlertResult = { subscribersChecked: 0, alertsSent: 0, skippedCooldown: 0 };

  let subscribers = await getLinkedSubscribers();
  if (opts.onlyEmail) {
    const target = opts.onlyEmail.toLowerCase();
    subscribers = subscribers.filter((s) => s.email.toLowerCase() === target);
    console.log(`[smart-alerts] TEST MODE: only ${subscribers.length} subscriber matching ${target}`);
  } else {
    console.log(`[smart-alerts] ${subscribers.length} linked subscribers`);
  }
  if (subscribers.length === 0) return result;

  const tournaments = await getUpcomingTournaments();
  console.log(`[smart-alerts] ${tournaments.length} upcoming tournaments`);
  if (tournaments.length === 0) return result;

  for (const sub of subscribers) {
    result.subscribersChecked++;

    if (await recentlyAlerted(sub.id)) {
      result.skippedCooldown++;
      continue;
    }

    const partnerNames = await getPastPartnerNames(sub.player_id);

    const scored: ScoredTournament[] = [];
    for (const t of tournaments) {
      if (await alreadyAlerted(sub.id, t.id)) continue;
      const score = scoreTournament(t, sub.dupr_doubles, partnerNames);
      if (score.total >= SCORE_THRESHOLD) scored.push({ tournament: t, score });
    }

    if (scored.length === 0) continue;

    scored.sort((a, b) => b.score.total - a.score.total);
    const best = scored[0];

    const html = buildAlertHtml(sub, best.tournament, best.score);

    if (opts.dryRun) {
      console.log(
        `[smart-alerts] DRY RUN — would send ${sub.email} → ${best.tournament.name} (score=${best.score.total}, reasons=${best.score.reasons.join(",")})`,
      );
      result.alertsSent++;
      continue;
    }

    try {
      await resend!.emails.send({
        from: "PickleRadar <alerts@pickleradar.app>",
        to: sub.email,
        subject: `🏓 ${best.tournament.name} looks good for you${sub.name ? `, ${sub.name.split(" ")[0]}` : ""}`,
        html,
      });

      await supabase.from("tournament_alerts_sent").insert({
        subscriber_id: sub.id,
        tournament_id: best.tournament.id,
        reasons: best.score.reasons,
        score: best.score.total,
      });

      result.alertsSent++;
      posthog?.capture({
        distinctId: sub.id,
        event: "smart_alert_sent",
        properties: {
          tournament_id: best.tournament.id,
          tournament_name: best.tournament.name,
          score: best.score.total,
          reasons: best.score.reasons,
          matched_event_name: best.score.matchedEventName ?? null,
          matched_partner_name: best.score.matchedPartnerName ?? null,
        },
      });
      console.log(
        `[smart-alerts] ✓ ${sub.email} → ${best.tournament.name} (score=${best.score.total}, reasons=${best.score.reasons.join(",")})`,
      );
    } catch (err) {
      posthog?.captureException(err, SCRAPER_ID, { subscriber_id: sub.id });
      console.error(`[smart-alerts] Send failed for ${sub.email}:`, err);
    }
  }

  if (result.alertsSent > 0) {
    await sendDiscordAlert({
      title: "🏓 Smart alerts sent",
      description: `${result.alertsSent} personalized alerts to linked subscribers · ${result.skippedCooldown} in cooldown`,
    });
  }

  return result;
}

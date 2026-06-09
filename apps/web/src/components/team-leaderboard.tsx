"use client";

import Link from "next/link";
import type { TournamentEvent } from "@/lib/types";
import { teamLeaderboard, type LbTeam, type LbMember, type RatingStatus } from "@/lib/field-intel";

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const RATING_COLOR: Record<RatingStatus, string> = {
  verified: "text-emerald-700",
  live: "text-gray-900", // real DUPR rating, verification unknown — show it plainly
  provisional: "text-amber-600",
  self: "text-gray-500",
  none: "text-gray-300",
};

function MemberRow({ m }: { m: LbMember }) {
  return (
    // Three columns so ratings scan as a table: name (fills) · right-aligned
    // number · a fixed check slot that's always reserved (keeps numbers aligned
    // whether or not a row is verified). We show each player's factual rating and
    // verification status only — never an individual "over cap"/sandbagger brand.
    // Field-level honesty (counts of over-cap ratings) lives in FieldHonesty and
    // DuprDistribution, attributed to the field, never to a named person. (A
    // visible accusation next to a non-consenting amateur's name is reputational
    // harm + legal/takedown exposure — see consent floor.)
    <div className="grid grid-cols-[1fr_auto_0.75rem] items-center gap-x-1.5">
      <span className="min-w-0 truncate t-body font-semibold text-gray-900">
        {m.id ? (
          <Link href={`/players/${m.id}`} className="hover:text-emerald-700 hover:underline">
            {m.name}
          </Link>
        ) : (
          m.name
        )}
      </span>
      <span className="flex items-center justify-end gap-1.5">
        <span className={`text-right t-body font-bold tabular-nums ${RATING_COLOR[m.status]}`}>
          {m.rating != null ? m.rating.toFixed(2) : "—"}
        </span>
      </span>
      <span className="flex w-3 justify-center">
        {m.status === "verified" && <Check className="h-2.5 w-2.5 text-emerald-700" />}
      </span>
    </div>
  );
}

function TeamRow({
  team,
  scoreLabel,
}: {
  team: LbTeam;
  scoreLabel: string;
}) {
  return (
    <div className="grid grid-cols-[22px_1fr_auto] items-center gap-x-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0">
      <span className={`text-center t-body font-bold tabular-nums ${team.rank != null ? "text-emerald-700" : "text-gray-300"}`}>
        {team.rank ?? "—"}
      </span>
      <div className="flex flex-col gap-1 border-l-2 border-gray-100 pl-2.5">
        {team.members.map((m, i) => (
          <MemberRow key={`${m.name}-${i}`} m={m} />
        ))}
      </div>
      <div className="flex min-w-[56px] flex-col items-end">
        <span className="text-[8.5px] font-bold uppercase tracking-wide text-gray-400">{scoreLabel}</span>
        <span className={`t-h2 leading-none tabular-nums tracking-tight ${team.verified ? "text-emerald-700" : "text-gray-500"}`}>
          {team.teamRating != null ? team.teamRating.toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}

export function TeamLeaderboard({ event }: { event: TournamentEvent }) {
  const lb = teamLeaderboard(event);
  if (lb.ranked.length === 0 && lb.awaiting.length === 0) {
    return <p className="py-2 t-body text-gray-400">No player data available</p>;
  }

  const scoreLabel = lb.isDoubles ? "Team" : "Rating";
  const groupNoun = lb.isDoubles ? "teams" : "players";

  return (
    <div className="mt-4 border-t border-gray-100 pt-3.5">
      <p className="t-caption font-bold uppercase tracking-wide text-gray-400">
        {lb.isDoubles ? "Team leaderboard" : "Leaderboard"}
      </p>

      {lb.ranked.length > 0 && (
        <>
          <p className="px-0.5 pb-1.5 pt-3 t-label tracking-wide text-gray-400">
            Verified {groupNoun}{" "}
            <span className="font-medium normal-case tracking-normal text-gray-400">· ranked by rating</span>
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {lb.ranked.map((t) => (
              <TeamRow key={t.key} team={t} scoreLabel={scoreLabel} />
            ))}
          </div>
        </>
      )}

      {lb.awaiting.length > 0 && (
        <>
          <p className="px-0.5 pb-1.5 pt-3 t-label tracking-wide text-gray-400">
            Awaiting verification
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {lb.awaiting.map((t) => (
              <TeamRow key={t.key} team={t} scoreLabel={scoreLabel} />
            ))}
          </div>
        </>
      )}

      {/* Status legend — verification lives on each individual rating */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 t-caption text-gray-500">
        <span className="flex items-center gap-1">
          <Check className="h-2.5 w-2.5 text-emerald-700" />
          <span className="font-semibold text-emerald-700">Verified</span> DUPR
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-gray-500">Self-rated</span>
        </span>
      </div>
    </div>
  );
}

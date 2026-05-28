"use client";

import Link from "next/link";
import type { EventPlayer } from "@/lib/types";

function DuprCell({ listed, live, verified }: {
  listed: number | null;
  live: number | null;
  verified: boolean | null;
}) {
  // Only show the "corrected" treatment when we actually verified from DUPR
  const hasVerifiedLive = verified === true && live != null;
  const showDelta = hasVerifiedLive && listed != null && Math.abs(live! - listed) > 0.05;

  if (showDelta) {
    const delta = live! - listed!;
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-gray-400 line-through">
          {listed!.toFixed(2)}
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-emerald-600">
            {live!.toFixed(2)}
          </span>
          {delta > 0 ? (
            <span className="rounded bg-red-50 px-1 py-0.5 text-[10px] font-bold text-red-500">
              +{delta.toFixed(2)}
            </span>
          ) : (
            <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-bold text-blue-500">
              {delta.toFixed(2)}
            </span>
          )}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-emerald-500">
          Verified
        </span>
      </div>
    );
  }

  if (hasVerifiedLive) {
    return (
      <div className="flex flex-col items-end">
        <span className="font-semibold text-emerald-600">
          {live!.toFixed(2)}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-emerald-500">
          Verified
        </span>
      </div>
    );
  }

  if (listed != null) {
    return (
      <span className="font-semibold text-gray-700">
        {listed.toFixed(2)}
      </span>
    );
  }

  return <span className="text-gray-300">--</span>;
}

function teamDuprTotal(player: EventPlayer): number | null {
  const p1 = player.live_dupr ?? player.dupr_rating;
  const p2 = player.partner_live_dupr ?? player.partner_dupr_rating;
  if (p1 != null && p2 != null) return Math.round((p1 + p2) * 100) / 100;
  return null;
}

function teamDuprAvg(player: EventPlayer): number | null {
  const total = teamDuprTotal(player);
  if (total == null) return null;
  return Math.round((total / 2) * 100) / 100;
}

export function PlayerList({ players }: { players: EventPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="py-2 text-sm text-gray-400">No player data available</p>
    );
  }

  const hasAnyLiveDupr = players.some((p) => p.live_dupr != null);
  const isDoubles = players.some((p) => p.partner_name != null);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
      {/* Banner removed — section-level badge handles this */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">
              {hasAnyLiveDupr ? "Rating" : "Listed Rating"}
            </th>
            <th className="hidden px-3 py-2 sm:table-cell">Partner</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Partner Rating</th>
            {isDoubles && (
              <th className="hidden px-3 py-2 text-right sm:table-cell">Team</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-gray-50/50 align-middle">
              <td className="px-3 py-1.5 font-medium text-gray-900">
                {player.player_id ? (
                  <Link
                    href={`/players/${player.player_id}`}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    {player.player_name}
                  </Link>
                ) : (
                  player.player_name
                )}
                {isDoubles && player.partner_name && (() => {
                  const partnerRating = player.partner_live_dupr ?? player.partner_dupr_rating;
                  const teamTotal = teamDuprTotal(player);
                  const partnerVerified = player.partner_live_dupr_verified === true;
                  return (
                    <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-gray-400 sm:hidden">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="text-gray-400">w/</span>
                        {player.partner_id ? (
                          <Link
                            href={`/players/${player.partner_id}`}
                            className="text-emerald-600 hover:underline"
                          >
                            {player.partner_name}
                          </Link>
                        ) : (
                          <span>{player.partner_name}</span>
                        )}
                        {partnerRating != null && (
                          <span className={partnerVerified ? "font-semibold text-emerald-600" : "font-semibold text-gray-600"}>
                            {partnerRating.toFixed(2)}
                          </span>
                        )}
                      </span>
                      {teamTotal != null && (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <span className="text-gray-400">Team</span>
                          <span className="font-bold text-gray-700">{teamTotal.toFixed(2)}</span>
                          <span className="text-gray-300">· avg {teamDuprAvg(player)!.toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </td>
              <td className="px-3 py-1.5 text-right">
                <DuprCell
                  listed={player.dupr_rating}
                  live={player.live_dupr}
                  verified={player.live_dupr_verified}
                />
              </td>
              <td className="hidden px-3 py-1.5 text-gray-600 sm:table-cell">
                {player.partner_id ? (
                  <Link
                    href={`/players/${player.partner_id}`}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    {player.partner_name}
                  </Link>
                ) : (
                  player.partner_name ?? "--"
                )}
              </td>
              <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                <DuprCell
                  listed={player.partner_dupr_rating}
                  live={player.partner_live_dupr}
                  verified={player.partner_live_dupr_verified}
                />
              </td>
              {isDoubles && (
                <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                  {teamDuprTotal(player) != null ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-gray-800">
                        {teamDuprTotal(player)!.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        avg {teamDuprAvg(player)!.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-300">--</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

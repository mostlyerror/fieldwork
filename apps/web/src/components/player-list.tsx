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

export function PlayerList({ players }: { players: EventPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="py-2 text-sm text-gray-400">No player data available</p>
    );
  }

  const hasAnyLiveDupr = players.some((p) => p.live_dupr != null);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
      {/* Banner removed — section-level badge handles this */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">
              {hasAnyLiveDupr ? "DUPR" : "Listed DUPR"}
            </th>
            <th className="hidden px-3 py-2 sm:table-cell">Partner</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Partner DUPR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-gray-50/50">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

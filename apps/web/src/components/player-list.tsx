"use client";

import Link from "next/link";
import type { EventPlayer } from "@/lib/types";

export function PlayerList({ players }: { players: EventPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="py-2 text-sm text-gray-400">No player data available</p>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">DUPR</th>
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
                {player.dupr_rating != null ? (
                  <span className="font-semibold text-gray-700">
                    {player.dupr_rating.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-300">--</span>
                )}
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
                {player.partner_dupr_rating != null ? (
                  <span className="font-semibold text-gray-700">
                    {player.partner_dupr_rating.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-300">--</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

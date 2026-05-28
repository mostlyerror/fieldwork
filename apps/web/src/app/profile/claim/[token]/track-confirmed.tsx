"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function TrackConfirmed({ playerId }: { playerId: string | null }) {
  useEffect(() => {
    track("claim_flow_confirmed", { playerId });
  }, [playerId]);
  return null;
}

"use client";

import { useEffect } from "react";
import { track, identify } from "@/lib/analytics";

export function TrackConfirmed({
  playerName,
  subscriberEmail,
}: {
  playerName: string | null;
  subscriberEmail: string | null;
}) {
  useEffect(() => {
    if (subscriberEmail) {
      identify(subscriberEmail.toLowerCase(), {
        email: subscriberEmail.toLowerCase(),
        playerName: playerName ?? undefined,
        claim_status: "linked",
      });
    }
    track("claim_flow_confirmed", { playerName });
  }, [playerName, subscriberEmail]);
  return null;
}

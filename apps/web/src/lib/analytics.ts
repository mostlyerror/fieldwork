/**
 * Typed analytics events for PickleRadar.
 *
 * Use these instead of calling posthog.capture directly so event names
 * and properties stay consistent across the app. All calls are no-ops
 * when PostHog isn't initialized (e.g. local dev without keys).
 */

import posthog from "posthog-js";

type EventName =
  | "subscribe_form_viewed"
  | "subscribe_form_submitted"
  | "claim_flow_started"
  | "claim_flow_searched"
  | "claim_flow_candidate_picked"
  | "claim_flow_confirmation_sent"
  | "claim_flow_confirmed"
  | "signup_completed"
  | "claim_cta_clicked"
  | "profile_gate_viewed"
  | "profile_gate_signup_clicked"
  | "tournament_viewed"
  | "bracket_expanded"
  | "register_button_clicked"
  | "share_clicked"
  | "result_card_style_picked"
  | "result_card_downloaded";

export function track(
  event: EventName,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}

/** Associate the current session with an email/player after they identify themselves. */
export function identify(
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.identify(distinctId, properties);
}

/** Clear the identified user — call this on sign-out. */
export function resetIdentity(): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.reset();
}

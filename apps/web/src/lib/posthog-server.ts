import { PostHog } from "posthog-node";

const key = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;

export const posthogServer =
  key && host
    ? new PostHog(key, {
        host,
        flushAt: 1,
        flushInterval: 0,
        enableExceptionAutocapture: true,
      })
    : null;

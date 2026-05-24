# PickleRadar Product Strategy

## Status
Current working strategy as of 2026-05-12.

## Executive Summary
PickleRadar should be treated as a local tournament intelligence and distribution business, not just a tournament directory or mobile app.

The current codebase already supports a web-first wedge: tournament aggregation, Houston city pages, email capture, manual submissions, admin review, weekly digest operations, social post workflow, and DUPR/event intelligence. The native app is still a placeholder, so the fastest path to revenue is to monetize the web, email, and local community loop before investing heavily in mobile.

## Current Product Reality
The original spec describes a mobile-first product with push notifications, partner matching, and native sharing. The current implementation has evolved differently:

- Web-first tournament discovery with SEO-oriented city pages.
- Email subscriber capture and weekly digest.
- Scrapers for PickleballBrackets/PickleballTournaments and Pickleball Den.
- Manual tournament submission with AI-assisted extraction.
- Admin review for submissions, scraper status, social posts, and subscriber counts.
- DUPR-linked user profiles and personalized tournament recommendations.
- Event-level field analysis from bracket/player data.
- Native mobile app shell only; no functional mobile product yet.

This means the strongest short-term wedge is not "download the app." It is "check PickleRadar to find the right Houston tournament before registration fills up."

## Positioning
For players:

> PickleRadar helps Houston pickleball players find the right tournament before registration fills up.

For tournament directors and facilities:

> PickleRadar helps tournament directors fill brackets with the right local players.

## Why This Can Make Money
The core value is local intent. Tournament players are already willing to spend money on entry fees, travel, clinics, paddles, and DUPR-related competition. Tournament directors and facilities already need targeted local distribution.

Basic listings create trust and habit. Revenue should come from higher-intent distribution and intelligence:

- Tournament directors pay to promote events.
- Facilities pay for recurring visibility.
- Serious players pay for advanced field intelligence and alerts.

Do not take a cut of tournament registration fees. That would create channel conflict with tournament platforms and weaken the "all tournaments" promise.

## Recommended Monetization

### 1. Tournament Director Promotion
This is the first revenue product.

Offer:

- Featured tournament placement on PickleRadar.
- Inclusion in the weekly digest.
- Optional dedicated email/social promotion.
- Simple performance reporting: impressions, clicks, registrations clicked.

Suggested pricing:

- $49: featured listing.
- $99: featured listing plus weekly digest placement.
- $199: dedicated email/social push.
- $299/month: recurring TD/facility promotion package.

Why this first:

- Easy to sell manually.
- Does not require a native app.
- Matches the current email/admin/social infrastructure.
- Creates direct revenue from people with an immediate need to fill brackets.

### 2. Player Premium: Tournament Intelligence
This should come after the product has enough recurring player traffic.

Premium features:

- Personalized "best events for your DUPR."
- Field strength and sandbagger alerts.
- Skill/distance/event-type alerts.
- Watchlists for venues, TDs, brackets, or players.
- "Where should I play this weekend?" recommendations.

Suggested pricing:

- $5/month.
- $39/year.

Keep the basic tournament list free. Gate advanced DUPR intelligence and instant/targeted alerts.

### 3. Facility Sponsorship
This is the best local recurring revenue path once traffic is proven.

Offer:

- Featured venue profile.
- Sponsored placement in digest and tournament browser.
- "Upcoming events at this venue."
- Analytics for clicks and subscriber reach.

Suggested pricing:

- $200-500/month per facility.

## What Not To Prioritize Yet

### Native Mobile App
Do not lead with the mobile app until revenue or retention data justifies it. The web product already has the acquisition surfaces: SEO, email, sharing, and social.

### Partner Matching
Partner matching is plausible later, but it creates a second marketplace before the first one is proven. It is harder to seed, harder to moderate, and less directly monetizable than TD promotion.

### Paid Basic Listings
Do not charge players to browse tournaments. Free listings are the trust layer and the acquisition engine.

## Main Risk
Completeness is the product. If Houston players check PickleRadar and miss meaningful tournaments, trust drops quickly.

Before expanding cities, the operating goal should be:

- Cover the major Houston tournament sources.
- Make manual submission easy enough that the community fills gaps.
- Review pending submissions quickly.
- Keep the weekly digest reliable.

## 30-Day Revenue Plan

1. Add a "Promote your tournament" page or form.
2. Add a manual featured placement mechanism in admin.
3. Add featured tournament slots to the browser, detail page, and digest.
4. Create Stripe payment links for $49, $99, and $199 offers.
5. Personally contact 20 Houston tournament directors and facilities.
6. Send the weekly digest consistently.
7. Add a premium teaser around field intelligence and personalized alerts.
8. Close 3 paid TD promotions before building large new features.

## Success Metrics

- 700 Houston subscribers.
- 50% or better coverage of known upcoming Houston tournaments.
- 30% or better weekly digest open rate.
- 5-10% tournament detail click-through to registration.
- 3 paid TD/facility promotions.
- 20 users with linked DUPR/profile data.

## Product Priorities

1. Completeness of Houston tournament data.
2. Email/social distribution loop.
3. TD promotion revenue.
4. DUPR intelligence as player premium wedge.
5. Mobile app only after web retention and monetization signals are real.

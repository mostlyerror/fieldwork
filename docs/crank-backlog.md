# Crank backlog

Work queue for the scheduled cloud agent ("PickleRadar crank" routine). Goal: make
PickleRadar earn money with as little ongoing work from Ben as possible. Keep the
data pipes healthy first, then build revenue tests.

The agent takes the first task below that is not `[done]`, not `[blocked]`, and has
no open PR with the `crank` label. One task per PR. Ben reorders or edits this file
by hand. The agent only changes a task's status line inside its own PR.

Status tags: `[todo]`, `[done]`, `[blocked: reason]`.

Known outage (Ben's to fix, not the agent's): PickleballBrackets returns HTTP 403 to
GitHub's IPs, and the repo has no `DUPR_PROXY_URL` secret. The scraper already routes
through that proxy when the secret is set. Until Ben adds one, no new PBB tournaments
come in. Don't try to work around the block from code.

## 1. Alert when a scraper finds nothing `[todo]`

PickleballBrackets found 0 tournaments on every run from 2026-08-28 to 2026-09-29,
and each run was saved as `status: success`. Nobody noticed for a month.

- In `packages/scrapers`, after each source finishes, compare `tournaments_found`
  with that source's recent runs in `scraper_runs`. If it found 0 and the median of
  its last 10 runs is above 0, send a Discord alert (`sendDiscordAlert`) and save
  the run with a status that is not `success` (check the column's allowed values
  in `supabase/migrations` first).
- Unit test the "is this a suspicious zero" check as a pure function.

## 2. Keep one DUPR login instead of logging in every run `[todo]`

Since 2026-09-08 DUPR answers `/auth/v1.0/login/` with HTTP 428 and emails a
sign-in code. Every job logs in fresh, so it can't work. Jobs run with
`SKIP_DUPR=1` until this is fixed.

- Store the DUPR access token (and refresh token if the login response has one)
  in a Supabase table readable only by `service_role`. `getDuprToken()` in
  `packages/scrapers/src/utils/dupr-client.ts` reads it first and only logs in
  when there is no usable token.
- Add a script Ben runs once by hand: it logs in, asks for the emailed code on
  stdin, finishes the verification call, and saves the token. The agent cannot
  reach DUPR, so read the existing client code and write the verification call
  from what the 428 response contains. Mark every guess in a code comment and
  say in the PR which parts Ben has to check against a real login.
- Do not remove `SKIP_DUPR` from the workflows. Ben does that after testing.

## 3. Paddle affiliate links `[done]`

Passive revenue test. Add a small "Gear" card on player pages and tournament
pages linking to paddles by rating band (beginner, intermediate, advanced).

- Links are built from `NEXT_PUBLIC_AFFILIATE_TAG`. If it's unset, the card does
  not render at all. Add the var to `.env.example` files and to `infra.yaml` if
  one exists.
- Mark links `rel="sponsored noopener"` and add a one-line affiliate disclosure
  under the card.
- Fire a GA4 event on click so Ben can see if anyone uses it.
- Follow the design rules in `SPEC.md` and existing components (t-* type roles,
  shadow-card tokens, mobile first at 360px).

## 4. "Promote your tournament" page for directors `[todo]`

First paid product from `SPEC.md` section 2: featured placement for $49.

- Page at `/promote` explaining what a director gets, with the price, and a
  short form (name, email, tournament link, message). The form posts to a server
  action that sends a Discord alert. No payment integration yet.
- Add a `featured_until` column on tournaments (new migration) and show featured
  tournaments first with a quiet "Featured" label on the city page.
- Link to `/promote` from the footer and from tournament pages ("Running this
  tournament?").

## 5. Idea list `[todo]`

When everything above is done, blocked, or already in an open PR, do not invent
a big feature. Write a short PR that adds three ideas to the bottom of this
file, ranked by (money it could bring in) / (Ben's ongoing time), with one
paragraph each.

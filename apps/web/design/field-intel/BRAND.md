# PickleRadar — Brand & Build Spec (READ FIRST)

You are building ONE self-contained HTML mockup of a redesign for **PickleRadar's Field Intelligence** — the per-tournament competitive-intel surface that is the MAIN DRAW of the app. People visit specifically to see *who they'll actually be playing* before they register: how strong the field is, whether there are sandbaggers (under-rated ringers), where they'd rank.

## What the data is
Read `/tmp/pr-intel/data.json`. Shape:
- `tournament`: string — the tournament name.
- `brackets[]`: each is one event/division. Fields:
  - `name` (e.g. "Men's Doubles (3.5)"), `cat` ("Men's"|"Women's"|"Mixed"|"Open")
  - `skillMin`, `skillMax`: the bracket's DUPR skill window (either may be null = open on that side). E.g. min 3.5 max 4 means "3.5–4.0 only".
  - `registered`: # of teams (doubles) or players.
  - `liveAvg`: the field's TRUE average DUPR (from verified live ratings). `listedAvg`: what was self-reported at signup. The gap between them is the story.
  - `total`: # people with a known rating. `liveCount`: # with a VERIFIED live DUPR.
  - `inRange` / `below` / `ringers`: # of people inside the window / below the floor / **above the cap (the sandbaggers/ringers)**.
  - `ratingMin`, `ratingMax`: rating range of the field.
  - `tone`: "friendly" | "competitive" | "stacked" | "sandbagger" — pre-classified field strength.
  - `bins[]`: histogram, `{r: rating, c: count, z: zone}` where z is "below"|"in"|"above". Use for any distribution viz.
  - `ranked[]`: the leaderboard — verified teams sorted strongest first. Each `{rank, teamRating, members:[{name, rating, status}]}`. `status` is "verified"|"provisional"|"self"|"none".
  - `awaitingCount`: # of teams not yet verifiable.

**Use the REAL names and numbers from the JSON.** Do NOT invent players. The data has genuine ringer stories — e.g. a "Mixed Doubles" bracket capped at 3.5 contains **Raj Nair, a verified 4.16**, paired with a 2.8 partner (classic sandbagger pairing); the "Ladder Round Robin 3.5+" has **Austin Mireles at 5.32** in an open-ceiling field. Surface stories like these — that is the product's whole value.

## Brand system (MATCH IT EXACTLY — this is an existing product, not a greenfield)
- **Font:** Plus Jakarta Sans (load from Google Fonts). Weights 400–800. This is the brand face — warm geometric. (Ignore any generic "no Inter / use Geist" defaults; the brand is Plus Jakarta Sans.)
- **Palette — warm editorial, light mode only:**
  - Page background: `#FBF7ED` (warm cream). Card surface: `#FFFFFF` or `#FFFDF8`.
  - Ink (text): `#16201B` (near-black green-gray). Muted: `#6B7670`. Faint: `#9AA59E`.
  - Accent: dark emerald — primary `#065F46`, bright `#047857`, deep `#053E2E`. Tint bg `#ECFDF3`.
  - Hairlines/borders: `#E8E3D5` (warm) or `#EAEDE9`.
- **Zone / rating semantics (consistent across the app — keep these meanings):**
  - In-window / verified-good: emerald `#1F9D57`.
  - Below floor: warm gray `#AEB6BC`.
  - **Over the cap / RINGER / sandbagger: red `#E0483B`** — this is the alarm color, use it sparingly and deliberately for ringers.
  - Provisional rating: amber `#D08700`. Self-rated: gray `#8A938D`.
- **Type scale (px; the app roots at 18px but build this mockup self-contained at normal 16px root — just use these px sizes):** display 34/800, h1 26/800, h2 20/800, h3 17/700, body 15/500, small 13/500, caption 12/600, label 11/700 uppercase tracked +0.06em.
- **Surfaces:** soft cards, radius 14–18px, tinted shadow `0 18px 40px -24px rgba(6,40,30,0.28), 0 2px 8px -6px rgba(6,40,30,0.10)`. Hairline dividers over heavy boxes where it reads cleaner.
- **Icons:** inline SVG only, stroke 1.8, currentColor. NO emojis anywhere. NO icon-font/CDN deps.
- **Numbers:** tabular-nums for all ratings.

## Hard requirements
1. **Mobile-first.** Build the primary view at **390px wide** (iPhone). It must look intentional and complete at that width — this is the primary surface. You may add a `@media (min-width:768px)` enhancement but mobile is what gets judged.
2. **One file, fully self-contained.** Inline all CSS and JS in a single `.html`. Inline the data (copy the JSON you need directly into a `<script>` — do NOT fetch). It must render offline opened via `file://`.
3. **Real interaction.** At minimum: selecting between brackets updates the view (vanilla JS, no framework, no build). Include a thoughtful empty/await state for `awaitingCount`.
4. **Cover the three jobs** of Field Intelligence in your direction's voice: (a) browse/select the bracket, (b) see the field's rating distribution vs the window incl. ringers, (c) the ranked leaderboard of teams.
5. **No external requests** except the Google Fonts stylesheet. No images (use SVG/initials for any avatars). No Unsplash.
6. Clean, production-grade CSS. No leftover lorem. Polished empty/await states.

## Output
Write your finished mockup to the EXACT path given in your task. Print "DONE <path>" when finished. Do not commit anything.

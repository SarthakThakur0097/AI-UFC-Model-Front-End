# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Note on the imported `AGENTS.md`: it is a generic auto-generated rule block. The installed
> version here is **Next.js 14.2.35** (classic App Router, no breaking changes vs. its own docs),
> and `node_modules/next/dist/docs/` does **not** exist in this install — so there is no local
> guide to read. Use standard Next 14 App Router conventions.

## What this is

Frontend-only Next.js app for **FightAI** — AI-generated MMA/UFC fight predictions. It is a thin
presentation layer: **all data and all model inference live in a separate Flask backend**
(`fighter-ai-production.up.railway.app`). There is no database, no API route handler, and no
business logic in this repo. Every number rendered comes from a backend endpoint.

## Commands

```bash
npm run dev              # dev server on :3000
npm run build            # production build — the real check before pushing
npm start                # prod server; requires $PORT to be set (Railway/Render style)
npx eslint .             # lint — see caveat below
```

There is **no test framework** in this repo. Do not claim tests pass; verify with `npm run build`
and by exercising the page.

### Environment gotchas (verified in this checkout)

- **`npm run lint` is broken.** It runs `next lint`, and Next 14's linter does not understand the
  flat `eslint.config.mjs`; it drops into an interactive "configure ESLint" prompt and hangs.
  Run `npx eslint .` instead. Note the repo has **pre-existing** lint errors
  (`@typescript-eslint/no-explicit-any` in `FightRadar.tsx`, `react-hooks/set-state-in-effect`
  in the fetching client components) — a red lint run is not necessarily your change.
- **npm-spawned scripts get a stale Node 17.7.2**, while the interactive shell has Node 24.
  Anything launched through `npm run` / `npm exec` may die with
  "You are using Node.js 17.7.2. For Next.js, Node.js version >= v18.17.0 is required."
  Workaround: invoke the binary directly with the shell's node, e.g.
  `& "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next build`.
- `"dev": "next.cmd dev"` in `package.json` is **Windows-only** and will fail on Linux/macOS CI.
- `.env.local` is empty, so **dev falls back to `http://127.0.0.1:5000`** — you need the Flask
  backend running locally, or set `NEXT_PUBLIC_API_URL` to the Railway URL to develop against prod.

### Filename casing — recurring source of broken deploys

Windows is case-insensitive, Linux (the deploy target) is not. `git log` already contains a fix
for exactly this (`fix: correct FightRadar.tsx casing for Linux build`), and there is currently
another live instance: `app/page.tsx` imports `./components/MatrixRain` but the file on disk is
**`app/components/Matrixrain.tsx`**. Builds fine locally, fails on Linux. When adding or renaming
components, confirm the import string matches the on-disk filename byte-for-byte, and rename via
`git mv` so the case change is actually recorded.

## Architecture

### Two-tier data fetching

This is the most important thing to understand before touching a component.

**Tier 1 — server-rendered, at page load.** `app/page.tsx` is an async Server Component. It calls
into `app/lib/api.ts` and renders the full list of events and fights before any JS ships.

**Tier 2 — client-side, on expand.** Each fight row in `FightCard`/`PastCard` is collapsed by
default. Only when a user expands a row do the four detail components (`FighterRating`,
`FightRadar`, `MethodPerFighter`, `CommonOpponents`) mount and each fire their **own**
`useEffect` + `fetch` straight to the backend, bypassing `lib/api.ts` entirely. Each of these
files redeclares its own `const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"`.

Consequence: a new detail panel means a new client component owning its own fetch, loading, and
failure state. There is no shared client-side fetch helper or cache. All of them swallow errors
and return `null` rather than throwing.

### Predictions are precomputed — do not reintroduce per-fight calls

The most recent commit (`Read precomputed predictions from /upcoming instead of per-fight calls`)
moved prediction inference server-side. `GET /upcoming` now returns events with `pick`,
`confidence`, `f1_prob`, `f2_prob`, and `method` already attached per fight.
`getUpcomingFights()` carries these straight through. **Do not** add a fan-out of
`getPrediction()` calls over the fight list to populate the card — that is the pattern that was
deliberately removed. `getPrediction()` (`/predict/full`) remains only for one-off single-fight use.

A fight with no precomputed prediction is marked `error: true` (derived from
`f.error ?? (f.pick === undefined)`), and `page.tsx` substitutes placeholders (`pick: "—"`,
`conf: 0`, 50/50 probabilities) so the row still renders as `N/A` rather than blank.

### `app/lib/fights.ts` is dead code

It is an older duplicate of `getUpcomingFights` that predates precomputed predictions (no
prediction fields) and is imported by nothing. `app/lib/api.ts` is the live module — edit that
one. Deleting `fights.ts` is safe if you're already touching this area.

### Backend endpoints consumed

| Endpoint | Caller | Caching |
|---|---|---|
| `GET /upcoming` | `lib/api.ts` (server) | `revalidate: 300` |
| `GET /results?limit=` | `lib/api.ts` (server) | `no-store` |
| `GET /accuracy` | `lib/api.ts` (server) | `no-store` |
| `GET /predict/full?f1=&f2=` | `lib/api.ts` (server, unused by the page) | `revalidate: 60` |
| `GET /fighter/{name}/glicko` | `FighterRating` (client) | none |
| `GET /fighter/{name}/radar\|radar_adj\|radar_discipline\|radar_defense` | `FightRadar` (client) | none |
| `GET /predict/method_per_fighter?f1=&f2=` | `MethodPerFighter` (client) | none |
| `GET /predict/props?f1=&f2=` | `FightProps` (client) | `revalidate: 3600` |
| `GET /fight/common_opponents?f1=&f2=` | `CommonOpponents` (client) | none |

`FightRadar` has four modes and the axis label constants (`AXES_DISCIPLINE`, `AXES_DEFENSE`,
`AXES_RAW`, `AXES_ADJ`) **must match the backend's stat keys exactly** — a renamed key on the
backend silently renders a zeroed axis, not an error.

### The market layer (`lib/market.ts`, `components/MarketLine.tsx`)

`/upcoming` and `/results` carry `market_props` beside the model's own numbers: de-vigged
consensus prices for the three duration markets and the six corner x method props. `lib/market.ts`
owns the types and formatting, `MarketLine` renders one comparison row, and both `FightProps`
(duration) and `MethodPerFighter` (method) drop it under their existing bars.

Four rules, each of which exists because breaking it produces a plausible-looking wrong number:

1. **No edge on the moneyline.** `MarketLine` is only given a `modelP` for duration and method.
   The backend's RESEARCH.md §1 measures the winner model at or slightly below the closing line,
   so a green edge badge there would advertise something the project's own evidence says is not
   real. `edgeTone` also stays neutral below 3pp, because a de-vigged prop edge smaller than that
   is inside the noise of the de-vig itself.

2. **Match the side, not just the market.** The stored quotes are the *under* / *yes* sides
   (`u15`, `u25`, `dist`). The "Over 1.5 rounds" bar therefore gets **no** market row — pairing it
   with the under's quote would invert the sign of the edge while looking entirely reasonable.

3. **`market.f1` is the card's fighter_1.** The backend re-orients when BestFightOdds lists the
   corners the other way. Nothing in this repo can detect a regression there; each fighter would
   simply be shown against the other's method prices.

4. **Units differ across the wire.** Model method probabilities are 0-100; every market quote is
   0..1. `FighterColumn` divides by 100 before comparing. Duration props are already 0..1 on both
   sides.

A quote may also carry **`dk`** — DraftKings' own price, the only number here the operator can
actually take, since BestFightOdds carries neither of their books. It renders as `DK -110` beside
the board's best and is **highlighted when it beats that best**, which is the entire reason to put
the two next to each other. Comparison is on the raw American value (`dkBeatsBoard`), which is
correct across the sign change: -125 beats -135, and any plus price beats any minus one.

Two things not to lose: `dk` is captured MANUALLY (DK's odds API is behind bot protection), so it
is null far more often than the BFO fields and can be materially staler — `dk.at` is the only thing
that says how old it is. And it is **not** part of the de-vigged `p`, so an edge is never computed
against it.

`best` is best-of-the-books-BestFightOdds-quotes and is rendered with `best_book` beside it:
DraftKings and BetMGM post no prices there and Fanatics is not carried, so it is a market
reference, not a quote the user can take. `MarketFootnote` says so once per section. Missing data
renders as an em dash — never substitute a default, which is the same trap `?tab=odds` avoids by
refusing to fill in 50/50 for an unpredicted fight.

### Routing

Single route (`/`) with a tab switch driven by the `?tab=` query param, read from `searchParams`
in `page.tsx` (`upcoming` is the default; `past` renders the results view). `Navbar` navigates
with plain `<a href="/?tab=...">`, so switching tabs is a full page load. There are no nested
routes or route groups.

### Styling

Tailwind v4 via `@tailwindcss/postcss` — configured by `@import "tailwindcss"` in
`app/globals.css`, with **no `tailwind.config.js`**. The "Matrix" theme is a set of CSS custom
properties in `:root` (`--matrix-green`, `--bg-card`, `--border`, `--text-primary`, …). The
codebase deliberately mixes Tailwind utility classes with inline `style={{ background:
"var(--bg-card)" }}` for anything themed — follow that pattern rather than adding hardcoded hex
colors or extending a config that doesn't exist. `MatrixRain` is a full-screen canvas animation
rendered behind the content.

Note `app/loading.tsx` and `LoadingSkeleton` are still on the **old light-gray theme**
(`bg-gray-50`, `bg-white`) and contain hardcoded placeholder text ("UFC 328 — May 9, 2026").
They were not migrated when the Matrix theme landed.

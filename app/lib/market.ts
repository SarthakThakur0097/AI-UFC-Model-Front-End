// market.ts — the betting-market side of a fight, as served in
// /upcoming and /results under `market_props`.
//
// WHAT THESE NUMBERS ARE
// `p` is a DE-VIGGED probability in 0..1: the bookmaker's margin has been
// divided out, so it is directly comparable to a model probability and is NOT
// what the posted price implies on its own. `best`/`med` are American prices
// and are what you would actually be quoted.
//
// Only the markets the models price are carried: the moneyline (which arrives
// separately as marketF1/marketF2), the three duration markets, and the six
// corner x method props. Everything else BFO publishes is deliberately absent.
//
// TWO LIMITATIONS THE UI MUST NOT PAPER OVER
//
// 1. `best` is best-of-the-books-BestFightOdds-quotes. DraftKings and BetMGM
//    render as empty columns there, and Fanatics is not carried at all — so
//    for anyone betting at those books it is an analytical reference, not an
//    obtainable price. Label it as a market reference, never as "your price".
//
// 2. Every field is nullable at every level. A fight with no harvested line
//    must render as an em dash. Substituting a default (50/50, or the model's
//    own number) would manufacture an edge against a price that does not
//    exist, which is the specific mistake `?tab=odds` already guards against.

/** One priced market side. */
export type MarketQuote = {
  /** De-vigged probability, 0..1. Model-comparable. */
  p: number
  /** De-vigged OPENING consensus, 0..1. Null until the harvester has history. */
  open_p: number | null
  /** Best American price across the books BFO quotes. See limitation 1. */
  best: number | null
  /**
   * Which book is offering `best`. Null when the harvester predates the
   * book-name table. Shown beside the price on purpose: "+270" invites the
   * reader to assume it is available to them, "+270 FanDuel" says where it is
   * and, by omission, where it is not.
   */
  best_book?: string | null
  /** Median American price, computed in probability space. */
  med: number | null
  /** How many books are behind `p`. 1 means "one book", not "consensus". */
  books: number
}

/** Method probabilities for one corner. */
export type MarketMethodCorner = {
  ko: MarketQuote
  sub: MarketQuote
  dec: MarketQuote
}

/**
 * Fight-level method: the 3-class model's outcome space.
 *
 * Probabilities ONLY — no price. Each entry is the sum of two separately
 * priced props (f1_ko + f2_ko), and there is no single line at which that sum
 * can be backed, so quoting one would invent a bet that does not exist.
 */
export type MarketMethodFight = {
  ko: { p: number; open_p: number | null }
  sub: { p: number; open_p: number | null }
  dec: { p: number; open_p: number | null }
}

/**
 * The six method props as one de-vigged market: f1 and f2 legs sum to 1
 * across both corners, and `fight` sums the pairs. `f1` always means the
 * card's fighter_1 — the backend re-orients when BFO's corner order differs.
 */
export type MarketMethod = {
  f1: MarketMethodCorner
  f2: MarketMethodCorner
  fight: MarketMethodFight
}

export type MarketProps = {
  /** Under 1.5 rounds. */
  u15?: MarketQuote | null
  /** Under 2.5 rounds. */
  u25?: MarketQuote | null
  /** Goes the distance. */
  dist?: MarketQuote | null
  method?: MarketMethod | null
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const DASH = '—'

/** -227 -> "−227", 270 -> "+270", null -> "—". Uses a real minus sign. */
export function formatAmerican(odds: number | null | undefined): string {
  if (odds == null || !isFinite(odds)) return DASH
  const n = Math.round(odds)
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** 0.7492 -> "75%". Null-safe; matches props.ts's pct for consistency. */
export function formatPct(p: number | null | undefined): string {
  if (p == null || !isFinite(p)) return DASH
  return `${Math.round(p * 100)}%`
}

/**
 * Model minus market, in percentage points. Positive = the model rates this
 * side more likely than the de-vigged market does.
 *
 * Both inputs must be 0..1. Returns null if either is missing, so callers
 * render a dash rather than an edge computed against nothing.
 */
export function edgePp(
  modelP: number | null | undefined,
  marketP: number | null | undefined
): number | null {
  if (modelP == null || marketP == null) return null
  if (!isFinite(modelP) || !isFinite(marketP)) return null
  return (modelP - marketP) * 100
}

/** 5.23 -> "+5.2", -0.4 -> "−0.4". Null -> "—". */
export function formatEdge(pp: number | null): string {
  if (pp == null) return DASH
  const r = Math.round(Math.abs(pp) * 10) / 10
  return pp >= 0 ? `+${r.toFixed(1)}` : `−${r.toFixed(1)}`
}

/**
 * Movement since the opening line, in points of de-vigged probability.
 * Positive = the market has moved TOWARD this side.
 */
export function moveFromOpen(q: MarketQuote | null | undefined): number | null {
  if (!q || q.open_p == null) return null
  return (q.p - q.open_p) * 100
}

/**
 * How much weight an edge deserves visually.
 *
 * DELIBERATELY CONSERVATIVE, and not symmetric with how tempting the number
 * looks. RESEARCH.md's own measurements are that this model does not beat the
 * closing line on the moneyline, that submission probabilities above ~0.30 run
 * about 13pp overconfident, and that a de-vigged prop edge under a few points
 * is inside the noise of the de-vig itself. A 3pp threshold before an edge is
 * even tinted, and 8pp before it is called large, keeps the UI from advertising
 * differences that the project's own research says are not real.
 */
export function edgeTone(pp: number | null): 'none' | 'slight' | 'strong' {
  if (pp == null) return 'none'
  const a = Math.abs(pp)
  if (a < 3) return 'none'
  if (a < 8) return 'slight'
  return 'strong'
}

/** True when at least one market number is present. */
export function hasMarketProps(mp: MarketProps | null | undefined): boolean {
  if (!mp) return false
  return Boolean(mp.u15 || mp.u25 || mp.dist || mp.method)
}

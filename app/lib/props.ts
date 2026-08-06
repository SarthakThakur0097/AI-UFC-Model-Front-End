// props.ts — prop-market projections from GET /predict/props.
//
// Shape verified against production rather than transcribed from a spec.
// Everything in `duration` and `takedowns` is a probability in 0..1 (NOT a
// percentage like /upcoming's f1_prob) — multiply by 100 yourself. The strike
// quantiles are raw significant-strike counts.
//
// The endpoint is ORDER-SENSITIVE: pass f1/f2 in the same order the card lists
// them (fighter_1 / fighter_2 from /upcoming).

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'

export type StrikeQuantiles = {
  q10: number
  q25: number
  q50: number
  q75: number
  q90: number
}

export type TakedownProbs = {
  /** Probability of landing at least 1 / 2 / 3 takedowns. */
  p_ge1: number
  p_ge2: number
  p_ge3: number
}

export type FighterProps = {
  strikes: StrikeQuantiles
  takedowns: TakedownProbs
}

export type FightProps = {
  f1: string
  f2: string
  /** "lookup" | "lookup-mirrored" | "fallback" — provenance, not for display. */
  source?: string
  duration: {
    /**
     * Probability the fight ends BEFORE the halfway point (2:30) of round 2 —
     * i.e. how a sportsbook "Under 1.5 rounds" actually settles.
     */
    p_under_1_5: number
    /** Same, for the 2:30 mark of round 3. */
    p_under_2_5: number
    /** Probability the fight reaches the judges. */
    p_distance: number
  }
  stats: { f1: FighterProps; f2: FighterProps }
  trained_through?: string
  /** Rendered verbatim in the UI — it is the model's own hedge. */
  note?: string
}

/**
 * Why a props lookup produced nothing. These are NOT interchangeable:
 *
 *   "none"        — 404: the backend has too little history for one of these
 *                   fighters. Routine (~3 of 11 on a typical card) and should
 *                   render as an empty state, never an error.
 *   "unavailable" — 503: the prop models aren't loaded on the server (a deploy
 *                   gap). The section should hide entirely rather than imply
 *                   this matchup is unprojectable.
 *   "error"       — anything else, including a network failure.
 */
export type PropsFailure = 'none' | 'unavailable' | 'error'

export type PropsResult =
  | { ok: true; data: FightProps }
  | { ok: false; reason: PropsFailure }

export async function fetchFightProps(f1: string, f2: string): Promise<PropsResult> {
  try {
    const res = await fetch(
      `${API_URL}/predict/props?f1=${encodeURIComponent(f1)}&f2=${encodeURIComponent(f2)}`,
      { next: { revalidate: 3600 } }
    )
    if (res.status === 404) return { ok: false, reason: 'none' }
    if (res.status === 503) return { ok: false, reason: 'unavailable' }
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true, data: (await res.json()) as FightProps }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 0.7492 -> "75%". Input is a 0..1 probability, never an already-scaled number. */
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

/** Complementary side of a two-way market: Over = 1 - Under. */
export function complement(p: number): number {
  return 1 - p
}

/** "Islam Makhachev" -> "Makhachev". Keeps single-word names whole. */
export function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name.trim()
}

/** Position of a value within [lo, hi] as a 0..100 percentage, clamped. */
export function positionWithin(value: number, lo: number, hi: number): number {
  if (!(hi > lo)) return 50
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))
}

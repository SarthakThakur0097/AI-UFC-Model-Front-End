import type { MarketProps } from './market'
import { orderPastCard } from './mainEvent'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'

export async function getPrediction(f1: string, f2: string) {
  try {
    const res = await fetch(
      `${API_URL}/predict/full?f1=${encodeURIComponent(f1)}&f2=${encodeURIComponent(f2)}`,
      { next: { revalidate: 60 } }
    )
    const data = await res.json()

    return {
      f1: data.f1,
      f2: data.f2,
      pick: data.pick,
      conf: data.confidence,
      f1Prob: data.f1_prob,
      f2Prob: data.f2_prob,
      error: false,
      method: {
        Decision: data.Decision,
        'KO/TKO': data['KO/TKO'],
        Submission: data.Submission,
      }
    }
  } catch {
    return null
  }
}

export type VegasComparison = {
  correct: number
  total: number
  accuracy: number | null
  window: string
}

export type AccuracyResponse = {
  correct: number
  total: number
  accuracy: number
  vegas?: VegasComparison
}

export async function getAccuracy(): Promise<AccuracyResponse | null> {
  try {
    const res = await fetch(`${API_URL}/accuracy`, { cache: 'no-store' })
    return res.json()
  } catch {
    return null
  }
}

/**
 * Drop `market_props.dk_ml` from a past fight.
 *
 * `/results` alphabetises each pair, so its `f1`/`f2` are often the reverse of
 * the card. Most paired fields are re-oriented to match: `f1_prob`/`f2_prob`,
 * `market_f1`/`market_f2`, `blend_f1`/`blend_f2` and `market_props.method` all
 * flip with the corners (verified against the same fights while they were still
 * on /upcoming). `dk_ml` does NOT — it stays byte-identical, still keyed to the
 * original card's fighter_1, so on a swapped fight `dk_ml.f1` is the price for
 * the fighter shown in the f2 column.
 *
 * Nothing on the past tab reads it today, and rather than leave a field that
 * would render a confidently wrong price the first time someone wires it up, it
 * is removed here so it reads as absent. Delete this once `/results` re-orients
 * `dk_ml` the way it already re-orients `method`. The duration quotes (`u15`,
 * `u25`, `dist`) describe the fight rather than a corner and need no such care.
 */
function stripUnorientedMarket<T extends object>(fight: T): T {
  const mp = (fight as { market_props?: unknown }).market_props as
    | Record<string, unknown>
    | null
    | undefined
  if (!mp || typeof mp !== 'object' || !('dk_ml' in mp)) return fight
  const rest = { ...mp }
  delete rest.dk_ml
  return { ...fight, market_props: rest }
}

/**
 * Past cards, with the main event hoisted to the front of each fight list.
 *
 * `/results` carries no `position` field and returns fights in arbitrary order,
 * so the raw payload cannot be rendered card-style as-is. See lib/mainEvent.ts
 * for how the main event is recovered and what stays unrecoverable. Every card
 * gains a `mainEventKnown` flag; consumers must not badge a main event when it
 * is false.
 */
export async function getPastCards(limit = 3) {
  try {
    const res = await fetch(`${API_URL}/results?limit=${limit}`, {
      cache: 'no-store'
    })
    const cards = await res.json()
    if (!Array.isArray(cards)) return []
    return cards.map((card) => {
      const { fights, mainEventKnown } = orderPastCard(
        card?.event ?? '',
        Array.isArray(card?.fights) ? card.fights : []
      )
      return { ...card, fights: fights.map(stripUnorientedMarket), mainEventKnown }
    })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Upcoming fights — pulled live from the DB, WITH predictions precomputed
// server-side (no per-fight model calls on a user visit).
// ---------------------------------------------------------------------------

export type UpcomingFight = {
  event: string
  date: string
  tag: string
  tagColor: string
  f1: string
  f1Record: string
  f2: string
  f2Record: string
  // Backend already sends this; the odds tab uses it because 3 vs 5 scheduled
  // rounds materially changes total-rounds and distance reasoning.
  weightClass?: string
  // prediction fields (precomputed; may be absent if the pipeline hasn't run)
  pick?: string
  conf?: number
  f1Prob?: number
  f2Prob?: number
  /**
   * De-vigged betting-market consensus, 0-100. Analytical reference only, NOT a
   * bookable price. Null whenever no line was scraped for the fight — which is
   * the majority case, so every consumer must handle null.
   */
  marketF1?: number | null
  marketF2?: number | null
  /**
   * Learned model+market blend, 0-100, weighted roughly 3.5:1 toward the market.
   * Measured more accurate than either input, so this leads the UI when present.
   */
  blendF1?: number | null
  blendF2?: number | null
  method?: { Decision: number; 'KO/TKO': number; Submission: number; pick: string }
  methodPerFighter?: MethodPerFighterData | null
  commonOpponents?: { common: any[]; count: number } | null
  /**
   * De-vigged prop lines for the markets the models price — the three duration
   * markets and the six corner x method props. See lib/market.ts for the shape
   * and for the two limitations the UI must not paper over.
   *
   * Present on `error: true` fights too: the model failing says nothing about
   * whether a line exists, and those are exactly the debut/thin-history bouts
   * where the market is the only signal available.
   */
  marketProps?: MarketProps | null
  error?: boolean
}

export type MethodPerFighterData = {
  f1_name: string
  f2_name: string
  f1: { KO: number; Sub: number; Dec: number }
  f2: { KO: number; Sub: number; Dec: number }
  f1_win: number
  f2_win: number
}

/**
 * Flatten a fight list into per-event groups, preserving the order events and
 * fights arrived in. Shared by the upcoming and odds tabs so the two can't
 * drift apart.
 */
export function groupByEvent<T extends { event: string; date: string }>(
  items: T[]
): { event: string; date: string; fights: T[] }[] {
  const map = new Map<string, { event: string; date: string; fights: T[] }>()
  for (const item of items) {
    const group = map.get(item.event)
    if (group) group.fights.push(item)
    else map.set(item.event, { event: item.event, date: item.date, fights: [item] })
  }
  return Array.from(map.values())
}

// derive Main / Co-Main / Featured / Prelim from card position
function positionToTag(pos: number): { tag: string; tagColor: string } {
  if (pos === 0) return { tag: 'Main', tagColor: 'text-blue-400' }
  if (pos === 1) return { tag: 'Co-Main', tagColor: 'text-blue-400' }
  if (pos <= 4) return { tag: 'Featured', tagColor: 'text-blue-400' }
  return { tag: 'Prelim', tagColor: 'text-gray-400' }
}

// "2026-06-27" + location -> "Jun 27, 2026 · Baku, Azerbaijan"
function formatEventDate(iso: string, location: string): string {
  const d = new Date(iso + 'T00:00:00')
  const dateStr = isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return location ? `${dateStr} · ${location}` : dateStr
}

export async function getUpcomingFights(): Promise<UpcomingFight[]> {
  try {
    const res = await fetch(`${API_URL}/upcoming`, { next: { revalidate: 300 } })
    const events: {
      event: string
      date: string
      location: string
      fights: {
        f1: string; f2: string; weight_class: string; position: number
        pick?: string; confidence?: number; f1_prob?: number; f2_prob?: number
        market_f1?: number | null; market_f2?: number | null
        blend_f1?: number | null; blend_f2?: number | null
        method?: { Decision: number; 'KO/TKO': number; Submission: number; pick: string }
        method_per_fighter?: MethodPerFighterData | null
        common_opponents?: { common: any[]; count: number } | null
        market_props?: MarketProps | null
        error?: boolean
      }[]
    }[] = await res.json()

    const flat: UpcomingFight[] = []
    for (const ev of events) {
      for (const f of ev.fights) {
        const { tag, tagColor } = positionToTag(f.position)
        flat.push({
          event: ev.event,
          date: formatEventDate(ev.date, ev.location),
          tag,
          tagColor,
          f1: f.f1,
          f1Record: '',
          f2: f.f2,
          f2Record: '',
          weightClass: f.weight_class,
          // carry predictions straight through (already computed server-side)
          pick: f.pick,
          conf: f.confidence,
          f1Prob: f.f1_prob,
          f2Prob: f.f2_prob,
          marketF1: f.market_f1 ?? null,
          marketF2: f.market_f2 ?? null,
          blendF1: f.blend_f1 ?? null,
          blendF2: f.blend_f2 ?? null,
          method: f.method,
          methodPerFighter: f.method_per_fighter ?? null,
          commonOpponents: f.common_opponents ?? null,
          marketProps: f.market_props ?? null,
          error: f.error ?? (f.pick === undefined),
        })
      }
    }
    return flat
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Model calibration — cached server-side (precompute_calibration.py),
// refreshed weekly alongside the rest of the pipeline. Pure cache read here,
// same pattern as getAccuracy / getPastCards.
// ---------------------------------------------------------------------------

export type CalibrationBucket = {
  bucket: string // e.g. "65-70"
  n: number
  avg_predicted: number | null
  accuracy_pct: number | null
  calibration_gap: number | null
  low_sample: boolean
}

export type Calibration = {
  computed_at: string
  total_fights: number
  overall_accuracy: number
  buckets: CalibrationBucket[]
}

export async function getCalibration(): Promise<Calibration | null> {
  try {
    const res = await fetch(`${API_URL}/calibration`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Underdog / value-pick accuracy — computed live on every request (NOT
// cached like getCalibration), so it reflects the DB as it grows. Two
// distinct stats, see routes_content.py's /calibration/underdogs docstring
// for the difference between "underdog" and "value_pick".
// ---------------------------------------------------------------------------

export type UnderdogPick = {
  fight_id: string
  event_name: string
  event_date: string
  pick: string
  opponent: string
  pick_odds: number | null
  vegas_implied_pct: number
  model_prob_pct: number
}

export type UnderdogStat = {
  correct: number
  total: number
  accuracy: number | null
  low_sample: boolean
  definition: string
  picks?: UnderdogPick[]
}

export type UnderdogResponse = {
  underdog: UnderdogStat
  value_pick: UnderdogStat
}

export async function getUnderdogStats(): Promise<UnderdogResponse | null> {
  try {
    const res = await fetch(`${API_URL}/calibration/underdogs`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
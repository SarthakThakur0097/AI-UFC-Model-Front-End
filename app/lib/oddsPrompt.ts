// oddsPrompt.ts — assembles model predictions + hand-entered odds into a
// single Claude-ready prompt string.
//
// PURE. No `new Date()`, no `window`, no fetch — same input always produces the
// same string. That makes it snapshot-testable and lets app/api/**/route.ts
// import it unchanged in phase 2.
//
// Shapes below are redeclared rather than imported from api.ts so this module
// has no dependency outside odds.ts and never drags fetch/API_URL into a
// client bundle.

import { ADVISOR_SYSTEM_PROMPT } from './advisorSystemPrompt'
import {
  MARKETS,
  devig,
  formatAmericanOdds,
  hasAnyOdds,
  impliedProbability,
  overround,
  type AnyMarketSpec,
  type FightOddsNumeric,
  type MarketId,
} from './odds'

export type PromptMethodPerFighter = {
  f1: { KO: number; Sub: number; Dec: number }
  f2: { KO: number; Sub: number; Dec: number }
  f1_win?: number
  f2_win?: number
}

/** One past fight against a shared opponent. */
export type PromptCommonResult = {
  result: string
  method: string
  round: number | null
  date: string
}

export type PromptCommonOpponents = {
  count: number
  common: { opponent: string; f1: PromptCommonResult; f2: PromptCommonResult }[]
}

/**
 * A radar mode's stats. The backend returns two shapes: bare numbers
 * (discipline, defense) and objects (raw has `pct`; adjusted adds `label` and a
 * `z` score). Both are percentiles vs the fighter's division.
 */
export type PromptRadarMode = {
  stats?: Record<string, number | { pct?: number; z?: number; label?: string }>
  /** Backend flag for a thin sample — the numbers are less trustworthy. */
  limited?: boolean
} | null

export type PromptFighterProfile = {
  glicko?: { rating: number; percentile: number | null } | null
  radar?: {
    discipline?: PromptRadarMode
    defense?: PromptRadarMode
    adjusted?: PromptRadarMode
    raw?: PromptRadarMode
  } | null
} | null

export type PromptFightModel = {
  event: string
  /** Pre-formatted by api.ts, e.g. "Jun 27, 2026 · Baku, Azerbaijan". */
  date: string
  /** "Main" | "Co-Main" | "Featured" | "Prelim" */
  tag: string
  weightClass?: string
  f1: string
  f2: string
  /**
   * False when the backend had no precomputed prediction. When false, every
   * probability field below is undefined — NOT a 50/50 placeholder. Feeding a
   * fabricated 50% into edge math invents an edge on every unpredicted fight.
   */
  hasPrediction: boolean
  pick?: string
  /** 0-100 */
  conf?: number
  f1Prob?: number
  f2Prob?: number
  method?: { Decision: number; 'KO/TKO': number; Submission: number } | null
  methodPerFighter?: PromptMethodPerFighter | null
  /** Ships with /upcoming, so it costs nothing extra to include. */
  commonOpponents?: PromptCommonOpponents | null
}

export type PromptFightInput = {
  model: PromptFightModel
  /** Already normalized — contains only entered, valid values. */
  odds: FightOddsNumeric
  /**
   * Glicko rating + radar percentiles per fighter. Not in /upcoming — fetched
   * on demand at generate time for the handful of fights that have odds, since
   * eagerly loading every fighter on the card would be ~100 requests for data
   * that mostly never reaches the prompt.
   */
  profiles?: { f1: PromptFighterProfile; f2: PromptFighterProfile }
  notes?: string
}

export type OddsPromptInput = {
  /** ISO timestamp, passed IN so the builder stays pure. */
  generatedAt: string
  sportsbook?: string
  /**
   * EVERY live fight, including ones with no odds entered. The builder filters
   * to those with odds and derives the per-event "N of M" counts itself, which
   * is what makes multi-event cards come out right.
   */
  fights: PromptFightInput[]
  /** Saved entries skipped because they're no longer on the card. */
  staleSkipped?: number
  bankrollNote?: string
}

/** An event and its fights, as projected server-side for the odds tab. */
export type OddsEventGroup = {
  event: string
  date: string
  fights: PromptFightModel[]
}

// ---------------------------------------------------------------------------
// Model probability lookup
// ---------------------------------------------------------------------------

const pct = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`

/**
 * Backend percentages arrive as 0-100 floats (45.5, 5.9). Keep one decimal but
 * drop a trailing ".0", and round before summing so totals don't come out as
 * "26.200000000000003%".
 */
const round1 = (n: number): number => Math.round(n * 10) / 10
const pctFrom100 = (n: number): string => `${round1(n)}%`

const METHOD_FIELD: Record<string, 'KO' | 'Sub' | 'Dec'> = {
  ko: 'KO',
  sub: 'Sub',
  dec: 'Dec',
}

/**
 * The model's probability for one market leg, as 0..1, or null when the model
 * has nothing to say about that outcome.
 *
 * Deliberately returns null (not a guess) for total rounds, handicap, and the
 * decision-type split in exact method — the model has no round-level output and
 * no unanimous/split/majority breakdown.
 */
function modelProbFor(
  market: MarketId,
  key: string,
  m: PromptFightModel
): number | null {
  if (!m.hasPrediction) return null

  const mpf = m.methodPerFighter
  const perFighter = (slot: 'f1' | 'f2', which: 'KO' | 'Sub' | 'Dec'): number | null => {
    if (!mpf) return null
    const v = mpf[slot]?.[which]
    return typeof v === 'number' ? v / 100 : null
  }

  switch (market) {
    case 'moneyline': {
      const p = key === 'f1' ? m.f1Prob : key === 'f2' ? m.f2Prob : undefined
      return typeof p === 'number' ? p / 100 : null
    }

    case 'distance': {
      const dec = m.method?.Decision
      if (typeof dec !== 'number') return null
      return key === 'yes' ? dec / 100 : key === 'no' ? 1 - dec / 100 : null
    }

    case 'method': {
      const mm = /^(f1|f2)_(ko|sub|dec)$/.exec(key)
      if (!mm) return null
      return perFighter(mm[1] as 'f1' | 'f2', METHOD_FIELD[mm[2]])
    }

    case 'methodDouble': {
      const mm = /^(f1|f2)_(ko|sub|dec)_(ko|sub|dec)$/.exec(key)
      if (!mm) return null
      const slot = mm[1] as 'f1' | 'f2'
      const a = perFighter(slot, METHOD_FIELD[mm[2]])
      const b = perFighter(slot, METHOD_FIELD[mm[3]])
      return a === null || b === null ? null : a + b
    }

    case 'altMethodDouble': {
      const mm = /^f1([A-Za-z]+)_f2([A-Za-z]+)$/.exec(key)
      if (!mm) return null
      const norm = (s: string) => METHOD_FIELD[s.toLowerCase()]
      const a = perFighter('f1', norm(mm[1]))
      const b = perFighter('f2', norm(mm[2]))
      return a === null || b === null ? null : a + b
    }

    case 'fightMethod': {
      // Fight-level, so this maps straight onto the model's own fight-level
      // method distribution — no per-fighter summing or derivation needed.
      if (!m.method) return null
      const v =
        key === 'ko' ? m.method['KO/TKO'] : key === 'sub' ? m.method.Submission : key === 'dec' ? m.method.Decision : undefined
      return typeof v === 'number' ? v / 100 : null
    }

    // No model signal at all.
    case 'totalRounds':
    case 'handicap':
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Section rendering
// ---------------------------------------------------------------------------

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))

// Axis order and labels mirror FightRadar.tsx so the prompt reads in the same
// order as the chart on the homepage.
const AXES_DISCIPLINE = ['Striking', 'Power', 'Wrestling', 'Control', 'BJJ']
const AXES_DEFENSE = [
  'Striking Defense',
  'Takedown Defense',
  'Durability',
  'Ground Defense',
  'Distance Defense',
]
const AXES_RAW: [string, string][] = [
  ['slpm', 'Striking Volume'],
  ['str_acc', 'Striking Accuracy'],
  ['str_def', 'Striking Defense'],
  ['td_avg', 'TD / 15'],
  ['td_acc', 'TD Accuracy'],
  ['td_def', 'TD Defense'],
  ['sub_avg', 'Sub / 15'],
]
const AXES_ADJ: [string, string][] = [
  ['slpm', 'Striking Volume'],
  ['str_acc', 'Striking Accuracy'],
  ['td_avg', 'Takedowns'],
  ['td_acc', 'TD Accuracy'],
  ['sub_avg', 'Submission'],
  ['ctrl_time_per_min', 'Control'],
  ['kd_per_min', 'Knockdown Power'],
  ['ground_allowed', 'Ground Defense'],
  ['distance_allowed', 'Distance Defense'],
]

/** Render one radar mode as "Label 54.9 | Label 37.0 | ...", or '' if absent. */
function radarLine(
  mode: PromptRadarMode | undefined,
  axes: string[] | [string, string][]
): string {
  const stats = mode?.stats
  if (!stats) return ''
  const parts: string[] = []
  for (const axis of axes) {
    const [key, label] = Array.isArray(axis) ? axis : [axis, axis]
    const v = stats[key]
    if (v === undefined || v === null) continue
    if (typeof v === 'number') {
      parts.push(`${label} ${round1(v)}`)
    } else if (typeof v.pct === 'number') {
      // Fixed one decimal and an explicit sign, so the column reads uniformly:
      // "z +1.0" not "z +1", "z +0.0" not a bare "z 0".
      const z = typeof v.z === 'number' ? ` (z ${v.z >= 0 ? '+' : '-'}${Math.abs(round1(v.z)).toFixed(1)})` : ''
      parts.push(`${v.label ?? label} ${round1(v.pct)}${z}`)
    }
  }
  return parts.join(' | ')
}

function renderProfile(name: string, profile: PromptFighterProfile): string[] {
  if (!profile?.radar) return []
  const r = profile.radar
  const rows: string[] = []
  const push = (label: string, line: string, limited?: boolean) => {
    // Pad to 12: "Discipline:" is 11 chars, so a narrower column leaves no
    // space between the label and the first stat.
    if (line) rows.push(`      ${pad(label + ':', 12)}${line}${limited ? '  [LIMITED SAMPLE]' : ''}`)
  }
  push('Discipline', radarLine(r.discipline, AXES_DISCIPLINE), r.discipline?.limited)
  push('Defense', radarLine(r.defense, AXES_DEFENSE), r.defense?.limited)
  push('Raw', radarLine(r.raw, AXES_RAW), r.raw?.limited)
  push('Adjusted', radarLine(r.adjusted, AXES_ADJ), r.adjusted?.limited)
  return rows.length > 0 ? [`    ${name}`, ...rows] : []
}

function renderCommonOpponents(co: PromptCommonOpponents, f1: string, f2: string): string[] {
  if (!co.common || co.common.length === 0) {
    return ['  COMMON OPPONENTS: none']
  }
  const fmt = (r: PromptCommonResult) =>
    `${r.result} by ${r.method}${r.round ? ` R${r.round}` : ''} (${r.date})`
  return [
    `  COMMON OPPONENTS (${co.count})`,
    ...co.common.map(
      (c) => `    vs ${c.opponent}: ${f1} ${fmt(c.f1)}  //  ${f2} ${fmt(c.f2)}`
    ),
  ]
}

function renderMarket(
  spec: AnyMarketSpec,
  entered: Record<string, number>,
  m: PromptFightModel
): string[] {
  const oddsFields = spec.fields.filter((f) => f.kind === 'odds')
  const lineField = spec.fields.find((f) => f.kind === 'line')

  const presentOdds = oddsFields.filter((f) => typeof entered[f.key as string] === 'number')
  if (presentOdds.length === 0 && lineField === undefined) return []
  if (presentOdds.length === 0) return []

  const complete = spec.isComplete(entered)
  // De-vig only when the legs are mutually exclusive AND all present. On the
  // double-chance markets each leg covers two of three methods, so the set sums
  // to ~200% by construction — normalising it yields numbers that look like
  // fair probabilities but are roughly half the truth.
  const canDevig = spec.devigSafe && complete
  const implied = presentOdds.map((f) => impliedProbability(entered[f.key as string]))
  const fair = canDevig ? devig(implied) : []

  // Header: title, the posted line if this market has one, and completeness.
  let header = `  ${spec.promptTitle}`
  if (lineField) {
    const lv = entered[lineField.key as string]
    header += typeof lv === 'number' ? `  line ${lv}` : `  line NOT ENTERED`
  }
  if (!spec.devigSafe) {
    header += `  [overlapping outcomes — no-vig and overround are not meaningful here]`
  } else if (complete) {
    header += `  [complete, overround ${(overround(implied) * 100).toFixed(1)}%]`
  } else {
    header += `  [partial — ${presentOdds.length} of ${oddsFields.length} legs entered, no-vig not computable]`
  }

  // Long promptLabels (the cross-fighter double chance) overflow a fixed column
  // and would run straight into the price with no separator.
  const labelWidth = Math.max(44, ...presentOdds.map((f) => f.promptLabel(m.f1, m.f2).length + 2))

  const rows = presentOdds.map((f, i) => {
    const price = entered[f.key as string]
    const label = pad(f.promptLabel(m.f1, m.f2), labelWidth)
    const priceCol = pad(formatAmericanOdds(price), 7)
    let row = `    ${label}${priceCol}implied ${pad(pct(implied[i]), 8)}`
    if (canDevig) row += `no-vig ${pad(pct(fair[i]), 8)}`
    const mp = modelProbFor(spec.id, f.key as string, m)
    if (mp !== null) row += `model ${pct(mp)}`
    return row.replace(/\s+$/, '')
  })

  return [header, ...rows]
}

function renderFight(index: number, fight: PromptFightInput): string[] {
  const { model: m, odds } = fight
  const out: string[] = []

  const rounds = m.tag === 'Main' ? 5 : 3
  const wc = m.weightClass ? `${m.weightClass}, ` : ''
  out.push(
    `--- FIGHT ${index} [${m.tag.toUpperCase()}] ${m.f1} vs ${m.f2} (${wc}${rounds} rounds inferred)`
  )

  // -- model ---------------------------------------------------------------
  out.push('MODEL')
  if (!m.hasPrediction) {
    out.push(
      '  No precomputed prediction available for this fight. Exclude it from edge',
      '  analysis; treat the odds below as market context only.'
    )
  } else {
    if (m.pick) out.push(`  Pick: ${m.pick}${typeof m.conf === 'number' ? ` (${m.conf}% confidence)` : ''}`)
    if (typeof m.f1Prob === 'number' && typeof m.f2Prob === 'number') {
      out.push(
        `  Win probability:  ${m.f1} ${m.f1Prob.toFixed(1)}%  |  ${m.f2} ${m.f2Prob.toFixed(1)}%`
      )
    }
    if (m.method) {
      out.push(
        `  Method, fight level:  KO/TKO ${pctFrom100(m.method['KO/TKO'])}  |  ` +
          `Submission ${pctFrom100(m.method.Submission)}  |  Decision ${pctFrom100(m.method.Decision)}`
      )
    }
    if (m.methodPerFighter) {
      const p = m.methodPerFighter
      const sum1 = round1(p.f1.KO + p.f1.Sub + p.f1.Dec)
      const sum2 = round1(p.f2.KO + p.f2.Sub + p.f2.Dec)
      const leg = (v: { KO: number; Sub: number; Dec: number }) =>
        `KO ${pctFrom100(v.KO)} / Sub ${pctFrom100(v.Sub)} / Dec ${pctFrom100(v.Dec)}`
      const both = round1(sum1 + sum2)
      // Don't assert a convention — report what the numbers actually do and let
      // the reader draw the conclusion. Which convention the backend uses is
      // the difference between "by KO = 39%" and "by KO = 53%".
      const reading =
        Math.abs(both - 100) <= 5
          ? `both fighters together sum to ${both}%, so these read as a joint distribution over all six outcomes`
          : Math.abs(sum1 - 100) <= 5 && Math.abs(sum2 - 100) <= 5
            ? `each fighter sums to ~100%, so these read as conditional on that fighter winning`
            : `these sum to ${both}% together, matching neither a joint nor a conditional reading — treat with caution`
      out.push(
        `  Method, per fighter:  ${pad(m.f1, 22)}${pad(leg(p.f1), 34)}(sums to ${sum1}%)`,
        `                        ${pad(m.f2, 22)}${pad(leg(p.f2), 34)}(sums to ${sum2}%)`,
        `                        Note: ${reading}.`
      )
    }
  }

  // -- fighter rating + radar (same panels shown on the homepage) -----------
  const prof = fight.profiles
  const g1 = prof?.f1?.glicko
  const g2 = prof?.f2?.glicko
  if (g1 || g2) {
    // "percentile 98.1" rather than "98.1th percentile" — an ordinal suffix on a
    // decimal is always wrong ("93th", "98.1st").
    const line = (name: string, g?: { rating: number; percentile: number | null } | null) =>
      g
        ? `    ${pad(name, 22)}${pad(String(round1(g.rating)), 8)}${
            typeof g.percentile === 'number' ? `percentile ${round1(g.percentile)}` : 'percentile unknown'
          }`
        : `    ${pad(name, 22)}no rating available`
    out.push('  FIGHTER RATING (Glicko)', line(m.f1, g1), line(m.f2, g2))
  }

  const radar1 = renderProfile(m.f1, prof?.f1 ?? null)
  const radar2 = renderProfile(m.f2, prof?.f2 ?? null)
  if (radar1.length > 0 || radar2.length > 0) {
    out.push('  PERFORMANCE RADAR — percentile vs division (0-100, higher is better)')
    out.push(...radar1, ...radar2)
  }

  if (m.commonOpponents) {
    out.push(...renderCommonOpponents(m.commonOpponents, m.f1, m.f2))
  }

  // -- odds ----------------------------------------------------------------
  out.push('ODDS ENTERED')
  const notEntered: string[] = []
  for (const spec of MARKETS) {
    const section = odds[spec.id] as Record<string, number> | undefined
    const rows = section ? renderMarket(spec, section, m) : []
    if (rows.length === 0) notEntered.push(spec.title.toLowerCase())
    else out.push(...rows)
  }
  if (notEntered.length > 0) out.push(`  NOT ENTERED: ${notEntered.join(', ')}`)
  if (fight.notes) out.push(`  NOTES: ${fight.notes}`)

  return out
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildOddsPrompt(input: OddsPromptInput): string {
  const book = input.sportsbook ?? 'DraftKings'
  const withOdds = input.fights.filter((f) => hasAnyOdds(f.odds))
  const lines: string[] = []

  // Standing instructions first. These deliberately supersede any "rank every
  // positive-edge play" framing — §2 of that document measures that exact
  // strategy losing money.
  lines.push(ADVISOR_SYSTEM_PROMPT, '', '='.repeat(78), '')

  lines.push(
    'DATA CAVEATS — read before reasoning',
    '- These notes describe how THIS payload was assembled. Where they touch on betting',
    '  policy, the system prompt above wins.',
    '- On the system prompt\'s both-fighter-orders warning: it applies to only ONE of the two',
    '  method markets here. The per-fighter numbers come from a 6-class corner-by-method model',
    '  that the backend already mirror-averages, so they are order-symmetric as printed and',
    '  need no further averaging. The fight-level numbers come from a separate 3-class model',
    '  that is NOT order-independent, and only one order is available in this payload — so the',
    '  extra uncertainty applies to EXACT METHOD and to anything derived from it (including the',
    '  goes-the-distance proxy), not to METHOD OF VICTORY (PER FIGHTER).',
    `- Odds were typed manually at ${input.generatedAt} and may be stale. Book: ${book}.`,
    '- A missing market or leg means "I did not enter it", NOT "it is unavailable" and NOT',
    '  "the price is bad". Never infer anything from absence.',
    '- The model outputs ONLY: win probability, a fight-level method distribution, and a',
    '  per-fighter method distribution. It has NO round-level model and NO over/under model.',
    '  For Total Rounds and Goes-the-Distance you must DERIVE from the method distribution',
    '  (P(goes to decision) is the natural proxy for Distance-Yes), state that you are doing',
    '  so, and discount your confidence accordingly.',
    '- Fight-level METHOD and METHOD PER FIGHTER come from two different models and may not',
    '  reconcile. Per-fighter sums are printed so you can see the normalization convention.',
    '- There are two distinct method markets here, and they are NOT the same bet:',
    '    METHOD OF VICTORY (PER FIGHTER) — who wins and how ("Gamrot by KO/TKO"), priced',
    '      against the model\'s per-fighter method distribution.',
    '    EXACT METHOD — HOW THE FIGHT ENDS — the finish type regardless of who wins,',
    '      priced against the model\'s fight-level method distribution.',
    '  The second is the sum of the first over both fighters, so they are not independent',
    '  signals. Do not stack a bet on both sides of the same underlying outcome.',
    '- FIGHT GOES THE DISTANCE overlaps both: Yes is the same event as EXACT METHOD',
    '  Decision, and No is KO/TKO + Submission. Price whichever market is best; do not',
    '  treat agreement between them as independent confirmation.',
    '- The DOUBLE CHANCE markets are shown with implied probability only, no no-vig.',
    '  Their legs overlap (each covers two of three methods), so the set sums to ~200%',
    '  by construction rather than because of vig, and normalising it would understate',
    '  every leg by roughly half. Compare model vs raw implied there, and remember the',
    '  raw implied still includes the book\'s margin — so the bar for a real edge is',
    '  higher than the printed gap suggests.',
    '- FIGHTER RATING is Glicko: a rating number plus a percentile. NOTE the two',
    '  percentiles in this prompt have DIFFERENT denominators — the Glicko percentile is',
    '  against every fighter in the database regardless of weight class, while every',
    '  radar percentile is against that fighter\'s own division only. Do not compare one',
    '  to the other. Glicko is a strength prior, not a prediction for this fight.',
    '- PERFORMANCE RADAR values are PERCENTILES VS THE FIGHTER\'S OWN DIVISION (0-100),',
    '  not raw stats. "Striking Volume 0.6" means the 0.6th percentile for volume in',
    '  that division, i.e. very low — it is not 0.6 strikes per minute. The Adjusted',
    '  mode also carries a z-score (standard deviations from the division mean). A mode',
    '  marked [LIMITED SAMPLE] is computed from few fights — weight it down.',
    '  The four modes are four views of the same underlying stats:',
    '    Raw        — unadjusted career stats.',
    '    Discipline — the same stats grouped by skill area (striking, wrestling, BJJ…).',
    '    Defense    — how well the fighter limits what opponents do to them.',
    '    Adjusted   — performance relative to what those opponents typically allow, so',
    '                 beating a tough defender counts for more. Prefer Adjusted over Raw',
    '                 when the two disagree: a high Raw with a low Adjusted usually means',
    '                 the numbers were padded against weak opposition.',
    '  Because they share inputs, an axis can repeat across modes (e.g. Striking Defense',
    '  appears in both Defense and Raw). Agreement between modes is not extra evidence.',
    '- A radar value of exactly 0 usually means NO DATA, not "bottom of the division".',
    '  The backend returns null for an axis with no recorded attempts, which the Adjusted',
    '  mode omits entirely, but Raw and Discipline report the same axis as 0. So a fighter',
    '  showing "Wrestling 0 | BJJ 0" and "TD / 15 0" alongside an Adjusted mode that has no',
    '  takedown or submission axes at all has simply never attempted those things on record',
    '  — he is not the worst wrestler in the division. Read an isolated 0 as unknown, and',
    '  do not let it drag a fighter assessment down.',
    '- Radar percentiles are DESCRIPTIVE inputs, not model outputs. Use them to explain',
    '  and sanity-check an edge the win/method models produced, and to reason about',
    '  markets those models do not cover. Do not invent a probability from them.',
    '- COMMON OPPONENTS is raw fight history against shared opponents, with method and',
    '  round. Small samples and stale dates are common — a single result is weak',
    '  evidence, and styles-make-fights caveats apply.',
    '- Scheduled rounds are INFERRED from card position (Main = 5, otherwise 3) and may be wrong.',
    '- The HANDICAP / SPREAD market is a two-sided line market whose exact semantics are not',
    '  confirmed. Treat it as market context only; the model has no signal for it.',
    ''
  )

  if (input.bankrollNote) lines.push(`BANKROLL: ${input.bankrollNote}`, '')

  if (withOdds.length === 0) {
    lines.push('No odds were entered. Nothing to analyze.')
    return lines.join('\n')
  }

  // Group ALL fights by event, preserving arrival order, so each card can
  // report its own "N of M" rather than sharing one global total.
  const byEvent = new Map<string, PromptFightInput[]>()
  for (const f of input.fights) {
    const list = byEvent.get(f.model.event)
    if (list) list.push(f)
    else byEvent.set(f.model.event, [f])
  }

  let n = 0
  for (const [event, all] of byEvent) {
    const entered = all.filter((f) => hasAnyOdds(f.odds))
    if (entered.length === 0) continue

    lines.push(`CARD: ${event} — ${all[0].model.date}`)
    lines.push(`Fights with odds entered: ${entered.length} of ${all.length}`)
    lines.push('')
    for (const f of entered) {
      n++
      lines.push(...renderFight(n, f))
      lines.push('')
    }

    const omitted = all.length - entered.length
    if (omitted > 0) {
      lines.push(`${omitted} further fight(s) on this card have no odds entered and are omitted.`)
      lines.push('')
    }
  }
  if (input.staleSkipped && input.staleSkipped > 0) {
    lines.push(
      `${input.staleSkipped} saved entr(ies) for fights no longer on the card were skipped.`
    )
  }

  // No output-format block here: §6 of the system prompt already specifies one,
  // and a second competing spec would just muddy it.
  lines.push(
    '',
    'Work through the fights above using the decision rules in §4 of the system prompt,',
    'and report in the §6 format. Saying "no bet on this entire card" is a valid answer.'
  )

  return lines.join('\n')
}

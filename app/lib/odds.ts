// odds.ts — market taxonomy, parsing, and normalization for the odds-entry tab.
//
// PURE MODULE. No React, no `window`, no fetch. This is imported by client
// components today and by app/api/**/route.ts in phase 2, so it must stay
// runnable in both environments.
//
// The MARKETS table below is the single source of truth for the taxonomy:
// the types derive from it, the UI renders by iterating it, and the prompt
// builder formats by iterating it. Adding or relabeling a market is a
// one-entry change with no schema churn.

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type FighterSlot = 'f1' | 'f2'

export const METHOD3 = ['ko', 'sub', 'dec'] as const
export type Method3 = (typeof METHOD3)[number]

export const DC_COMBOS = ['ko_dec', 'ko_sub', 'sub_dec'] as const
export type DoubleChanceCombo = (typeof DC_COMBOS)[number]

export type MoneylineKey = FighterSlot
export type TotalRoundsKey = 'line' | 'over' | 'under'
export type HandicapKey = 'line' | 'f1' | 'f2'
export type MethodKey = `${FighterSlot}_${Method3}`
export type DistanceKey = 'yes' | 'no'
export type MethodDoubleKey = `${FighterSlot}_${DoubleChanceCombo}`
export type AltMethodDoubleKey = `f1${Capitalize<Method3>}_f2${Capitalize<Method3>}`
/** Fight-level: how the fight ends, either fighter. No fighter slot. */
export type FightMethodKey = Method3

/**
 * Per-fight odds. One level of nesting (market -> flat composite keys) because
 * that matches the UI 1:1: a market is a collapsible section, a field is an input.
 *
 * Generic over V so the taxonomy is declared once: FightOdds<string> is what the
 * UI and localStorage hold (raw text as typed), FightOdds<number> is what comes
 * out of normalizeFightOdds() and is all the prompt builder ever sees.
 *
 * Partial entry is represented by KEY ABSENCE — never null, never "".
 */
export type FightOdds<V = string> = {
  moneyline?: Partial<Record<MoneylineKey, V>>
  totalRounds?: Partial<Record<TotalRoundsKey, V>>
  handicap?: Partial<Record<HandicapKey, V>>
  method?: Partial<Record<MethodKey, V>>
  distance?: Partial<Record<DistanceKey, V>>
  methodDouble?: Partial<Record<MethodDoubleKey, V>>
  altMethodDouble?: Partial<Record<AltMethodDoubleKey, V>>
  /**
   * Renamed from `exactMethod`, which was modelled per-fighter and therefore
   * duplicated `method`. Any odds saved under the old key are simply never read
   * — the loader only walks markets that exist in MARKETS.
   */
  fightMethod?: Partial<Record<FightMethodKey, V>>
}

export type MarketId = keyof FightOdds
export type FightOddsInput = FightOdds<string>
export type FightOddsNumeric = FightOdds<number>

/** The valid field keys for a given market, as a string union. */
export type FieldKeyOf<M extends MarketId> = keyof NonNullable<FightOdds<string>[M]> & string

// ---------------------------------------------------------------------------
// Spec table
// ---------------------------------------------------------------------------

/**
 * "odds" fields hold American odds and participate in de-vig math.
 * "line" fields hold the book's posted line (2.5, -3.5) and do not.
 */
export type FieldKind = 'odds' | 'line'

export type MarketField<M extends MarketId = MarketId> = {
  key: FieldKeyOf<M>
  kind: FieldKind
  /** Short label for the input itself, in flat (non-grid) layouts. */
  label: (f1: string, f2: string) => string
  /** Full sentence used in the generated prompt. */
  promptLabel: (f1: string, f2: string) => string
  /**
   * Row label in grid layouts, where the fighter name is already a column
   * header and repeating it in every cell is noise.
   */
  rowLabel?: () => string
  /** Column label in the 3x3 cross-fighter grid. */
  colLabel?: () => string
  placeholder?: string
}

export type MarketSpec<M extends MarketId = MarketId> = {
  id: M
  title: string
  promptTitle: string
  hint?: string
  layout: 'pair' | 'line2' | 'grid3x2' | 'grid5x2' | 'list'
  /**
   * True when every odds-kind leg is present, so no-vig normalization is
   * meaningful. De-vigging a partial market silently produces wrong fair
   * probabilities, so the prompt refuses to do it unless this passes.
   */
  isComplete: (entered: Record<string, number>) => boolean
  /** f1/f2-swapped counterpart of a key, for feed orientation flips. */
  mirrorKey: (key: string) => string
  /** Value transform on mirror (only the handicap line needs one). */
  mirrorValue?: (key: string, value: string) => string
  fields: readonly MarketField<M>[]
}

export type AnyMarketSpec = { [M in MarketId]: MarketSpec<M> }[MarketId]

// -- label helpers ----------------------------------------------------------

/** "Alex Pereira" -> "Pereira". Falls back to the whole string. */
export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name.trim()
}

const METHOD3_LABEL: Record<Method3, string> = {
  ko: 'KO/TKO',
  sub: 'Submission',
  dec: 'Decision',
}

const DC_LABEL: Record<DoubleChanceCombo, string> = {
  ko_dec: 'KO/TKO or Decision',
  ko_sub: 'KO/TKO or Submission',
  sub_dec: 'Submission or Decision',
}

const nameFor = (slot: FighterSlot, f1: string, f2: string) => (slot === 'f1' ? f1 : f2)

/** Swap a leading "f1_" / "f2_" prefix. */
const swapSlotPrefix = (key: string): string =>
  key.startsWith('f1_') ? `f2_${key.slice(3)}` : key.startsWith('f2_') ? `f1_${key.slice(3)}` : key

/** Every odds-kind field present. */
const allOddsLegsPresent =
  (keys: readonly string[]) =>
  (entered: Record<string, number>): boolean =>
    keys.every((k) => typeof entered[k] === 'number')

// -- field builders ---------------------------------------------------------

const method3Fields = <M extends MarketId>(): MarketField<M>[] =>
  (['f1', 'f2'] as const).flatMap((slot) =>
    METHOD3.map((m) => ({
      key: `${slot}_${m}` as FieldKeyOf<M>,
      kind: 'odds' as const,
      label: (f1: string, f2: string) => `${lastName(nameFor(slot, f1, f2))} ${METHOD3_LABEL[m]}`,
      promptLabel: (f1: string, f2: string) =>
        `${nameFor(slot, f1, f2)} by ${METHOD3_LABEL[m]}`,
      rowLabel: () => METHOD3_LABEL[m],
      placeholder: '+250',
    }))
  )

/**
 * Fight-level outcomes — how the fight ends, either fighter. Three legs, no
 * fighter slot; this is the market the backend's fight-level `method`
 * distribution maps to directly.
 */
const fightMethodFields = (): MarketField<'fightMethod'>[] =>
  METHOD3.map((m) => ({
    key: m as FightMethodKey,
    kind: 'odds' as const,
    label: () => METHOD3_LABEL[m],
    promptLabel: () => `Fight ends by ${METHOD3_LABEL[m]} (either fighter)`,
    placeholder: '+150',
  }))

const doubleChanceFields = <M extends MarketId>(): MarketField<M>[] =>
  (['f1', 'f2'] as const).flatMap((slot) =>
    DC_COMBOS.map((c) => ({
      key: `${slot}_${c}` as FieldKeyOf<M>,
      kind: 'odds' as const,
      label: (f1: string, f2: string) => `${lastName(nameFor(slot, f1, f2))} ${DC_LABEL[c]}`,
      promptLabel: (f1: string, f2: string) => `${nameFor(slot, f1, f2)} by ${DC_LABEL[c]}`,
      rowLabel: () => DC_LABEL[c],
      placeholder: '+150',
    }))
  )

const altDoubleChanceFields = (): MarketField<'altMethodDouble'>[] =>
  METHOD3.flatMap((a) =>
    METHOD3.map((b) => {
      const cap = (m: Method3) => (m.charAt(0).toUpperCase() + m.slice(1)) as Capitalize<Method3>
      return {
        key: `f1${cap(a)}_f2${cap(b)}` as AltMethodDoubleKey,
        kind: 'odds' as const,
        // Worded exactly as the book lists the selection, so entering odds is
        // transcription rather than mapping a line onto a matrix cell.
        label: (f1: string, f2: string) =>
          `${f1} to win by ${METHOD3_LABEL[a]} or ${f2} to win by ${METHOD3_LABEL[b]}`,
        promptLabel: (f1: string, f2: string) =>
          `${f1} by ${METHOD3_LABEL[a]} or ${f2} by ${METHOD3_LABEL[b]}`,
        placeholder: '+300',
      }
    })
  )

const METHOD_KEYS = (['f1', 'f2'] as const).flatMap((s) => METHOD3.map((m) => `${s}_${m}`))
const DC_KEYS = (['f1', 'f2'] as const).flatMap((s) => DC_COMBOS.map((c) => `${s}_${c}`))
const ALT_DC_KEYS = altDoubleChanceFields().map((f) => f.key as string)

// -- the table --------------------------------------------------------------

export const MARKETS: readonly AnyMarketSpec[] = [
  {
    id: 'moneyline',
    title: 'Moneyline',
    promptTitle: 'MONEYLINE',
    layout: 'pair',
    isComplete: allOddsLegsPresent(['f1', 'f2']),
    mirrorKey: (k) => (k === 'f1' ? 'f2' : k === 'f2' ? 'f1' : k),
    fields: [
      {
        key: 'f1',
        kind: 'odds',
        label: (f1) => lastName(f1),
        promptLabel: (f1) => f1,
        placeholder: '-155',
      },
      {
        key: 'f2',
        kind: 'odds',
        label: (_f1, f2) => lastName(f2),
        promptLabel: (_f1, f2) => f2,
        placeholder: '+130',
      },
    ],
  },
  {
    id: 'totalRounds',
    title: 'Total rounds',
    promptTitle: 'TOTAL ROUNDS',
    hint: 'Enter the line the book posted (1.5, 2.5, 3.5, 4.5), then both prices.',
    layout: 'line2',
    isComplete: allOddsLegsPresent(['over', 'under']),
    mirrorKey: (k) => k,
    fields: [
      {
        key: 'line',
        kind: 'line',
        label: () => 'Line',
        promptLabel: () => 'line',
        placeholder: '2.5',
      },
      {
        key: 'over',
        kind: 'odds',
        label: () => 'Over',
        promptLabel: () => 'Over',
        placeholder: '+105',
      },
      {
        key: 'under',
        kind: 'odds',
        label: () => 'Under',
        promptLabel: () => 'Under',
        placeholder: '-135',
      },
    ],
  },
  {
    id: 'handicap',
    title: 'Handicap / spread',
    promptTitle: 'HANDICAP / SPREAD',
    hint: 'Line as posted for the first fighter. Market semantics unconfirmed — see notes.',
    layout: 'line2',
    isComplete: allOddsLegsPresent(['f1', 'f2']),
    mirrorKey: (k) => (k === 'f1' ? 'f2' : k === 'f2' ? 'f1' : k),
    // Flipping which fighter is "first" negates the posted line.
    mirrorValue: (key, value) => {
      if (key !== 'line') return value
      const n = parseLine(value)
      return n === null ? value : String(-n)
    },
    fields: [
      {
        key: 'line',
        kind: 'line',
        label: () => 'Line',
        promptLabel: () => 'line',
        placeholder: '-3.5',
      },
      {
        key: 'f1',
        kind: 'odds',
        label: (f1) => lastName(f1),
        promptLabel: (f1) => f1,
        placeholder: '-110',
      },
      {
        key: 'f2',
        kind: 'odds',
        label: (_f1, f2) => lastName(f2),
        promptLabel: (_f1, f2) => f2,
        placeholder: '-110',
      },
    ],
  },
  {
    id: 'method',
    title: 'Method of victory (per fighter)',
    promptTitle: 'METHOD OF VICTORY (PER FIGHTER)',
    hint: 'Who wins AND how, e.g. "Gamrot by KO/TKO".',
    layout: 'grid3x2',
    isComplete: allOddsLegsPresent(METHOD_KEYS),
    mirrorKey: swapSlotPrefix,
    fields: method3Fields<'method'>(),
  },
  {
    id: 'distance',
    title: 'Fight goes the distance',
    promptTitle: 'FIGHT GOES THE DISTANCE',
    layout: 'pair',
    isComplete: allOddsLegsPresent(['yes', 'no']),
    mirrorKey: (k) => k,
    fields: [
      {
        key: 'yes',
        kind: 'odds',
        label: () => 'Yes',
        promptLabel: () => 'Yes (goes to decision)',
        placeholder: '+140',
      },
      {
        key: 'no',
        kind: 'odds',
        label: () => 'No',
        promptLabel: () => 'No (finish inside the distance)',
        placeholder: '-175',
      },
    ],
  },
  {
    id: 'methodDouble',
    title: 'Method double chance',
    promptTitle: 'METHOD OF VICTORY — DOUBLE CHANCE',
    hint: 'One fighter, either of two methods.',
    layout: 'grid3x2',
    isComplete: allOddsLegsPresent(DC_KEYS),
    mirrorKey: swapSlotPrefix,
    fields: doubleChanceFields<'methodDouble'>(),
  },
  {
    id: 'altMethodDouble',
    title: 'Alt method double chance',
    promptTitle: 'ALTERNATIVE METHOD OF VICTORY — DOUBLE CHANCE',
    hint: 'Cross-fighter combinations, listed the way the book lists them.',
    layout: 'list',
    isComplete: allOddsLegsPresent(ALT_DC_KEYS),
    // f1Ko_f2Sub -> f1Sub_f2Ko
    mirrorKey: (k) => {
      const m = /^f1([A-Za-z]+)_f2([A-Za-z]+)$/.exec(k)
      return m ? `f1${m[2]}_f2${m[1]}` : k
    },
    fields: altDoubleChanceFields(),
  },
  {
    id: 'fightMethod',
    title: 'Exact method (either fighter)',
    promptTitle: 'EXACT METHOD — HOW THE FIGHT ENDS',
    hint: 'How the fight ends regardless of who wins. Not tied to a fighter.',
    layout: 'pair',
    isComplete: allOddsLegsPresent([...METHOD3]),
    // Fight-level, so there is no f1/f2 slot to mirror.
    mirrorKey: (k) => k,
    fields: fightMethodFields(),
  },
]

export const MARKET_BY_ID: Record<MarketId, AnyMarketSpec> = MARKETS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec
    return acc
  },
  {} as Record<MarketId, AnyMarketSpec>
)

// ---------------------------------------------------------------------------
// Parsing / formatting
// ---------------------------------------------------------------------------

/**
 * "+150" | "150" | "-180" -> 150 | 150 | -180. Returns null on anything else.
 *
 * Rejects |n| < 100 deliberately: there is no such thing as -50 American odds,
 * and accepting it yields an implied probability above 1, which poisons every
 * downstream edge calculation.
 */
export function parseAmericanOdds(raw: string): number | null {
  const s = raw.trim()
  if (!/^[+-]?\d{2,5}$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n === 0) return null
  if (Math.abs(n) < 100) return null
  return n
}

/** "2.5" | "-3.5" -> 2.5 | -3.5. Returns null on anything else. */
export function parseLine(raw: string): number | null {
  const s = raw.trim()
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 150 -> "+150", -180 -> "-180", null -> "—". */
export function formatAmericanOdds(odds: number | null | undefined): string {
  if (odds === null || odds === undefined) return '—'
  return odds > 0 ? `+${odds}` : `${odds}`
}

/** American odds -> implied probability including vig, as 0..1. */
export function impliedProbability(americanOdds: number): number {
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : -americanOdds / (-americanOdds + 100)
}

/** Proportionally strip the overround. Returns [] if the input sums to 0. */
export function devig(probs: number[]): number[] {
  const sum = probs.reduce((a, b) => a + b, 0)
  if (sum <= 0) return []
  return probs.map((p) => p / sum)
}

/** Sum of implied probabilities minus 1, as a fraction (0.043 = 4.3% overround). */
export function overround(probs: number[]): number {
  return probs.reduce((a, b) => a + b, 0) - 1
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Lowercase, strip diacritics, collapse non-alphanumerics to single dashes. */
export function slug(s: string): string {
  return s
    .normalize('NFKD')
    // Strip combining diacritics so "Teixeira" and "Teixeíra" key identically.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Stable per-fight key. Fighter names are SORTED so a feed-side f1/f2 swap
 * doesn't orphan the saved entry — the positional slots inside the odds are
 * realigned separately by mirrorFightOdds().
 */
export function fightKey(event: string, f1: string, f2: string): string {
  const pair = [slug(f1), slug(f2)].sort().join('--')
  return `${slug(event)}::${pair}`
}

// ---------------------------------------------------------------------------
// Odds object operations
// ---------------------------------------------------------------------------

/** Immutably set one field. Empty/whitespace input deletes the key. */
export function setOddsField(
  odds: FightOddsInput,
  market: MarketId,
  key: string,
  value: string
): FightOddsInput {
  const next: FightOddsInput = { ...odds }
  const section: Record<string, string> = { ...((next[market] as Record<string, string>) ?? {}) }

  if (value.trim() === '') delete section[key]
  else section[key] = value

  if (Object.keys(section).length === 0) delete next[market]
  else (next as Record<string, unknown>)[market] = section

  return next
}

/** Immutably drop an entire market. */
export function clearMarket(odds: FightOddsInput, market: MarketId): FightOddsInput {
  const next: FightOddsInput = { ...odds }
  delete next[market]
  return next
}

/** How many values are entered (any market), counting raw non-empty strings. */
export function countEnteredValues(odds: FightOddsInput): number {
  let n = 0
  for (const spec of MARKETS) {
    const section = odds[spec.id] as Record<string, string> | undefined
    if (!section) continue
    for (const v of Object.values(section)) if (v.trim() !== '') n++
  }
  return n
}

/** How many values are entered for one market. */
export function countMarketValues(odds: FightOddsInput, market: MarketId): number {
  const section = odds[market] as Record<string, string> | undefined
  if (!section) return 0
  return Object.values(section).filter((v) => v.trim() !== '').length
}

/**
 * Realign positional f1/f2 slots when the feed flips fighter orientation.
 * Without this, a saved moneyline for fighter A silently attaches to fighter B.
 */
export function mirrorFightOdds(odds: FightOddsInput): FightOddsInput {
  const next: FightOddsInput = {}
  for (const spec of MARKETS) {
    const section = odds[spec.id] as Record<string, string> | undefined
    if (!section) continue
    const mirrored: Record<string, string> = {}
    for (const [k, v] of Object.entries(section)) {
      const mk = spec.mirrorKey(k)
      mirrored[mk] = spec.mirrorValue ? spec.mirrorValue(k, v) : v
    }
    ;(next as Record<string, unknown>)[spec.id] = mirrored
  }
  return next
}

/**
 * Raw text -> numbers, dropping everything that doesn't parse. A market whose
 * fields all fail to parse is omitted entirely, so the prompt builder can never
 * mention a value that wasn't validly entered.
 */
export function normalizeFightOdds(input: FightOddsInput): FightOddsNumeric {
  const out: FightOddsNumeric = {}

  for (const spec of MARKETS) {
    const section = input[spec.id] as Record<string, string> | undefined
    if (!section) continue

    const kindByKey = new Map<string, FieldKind>(
      spec.fields.map((f): [string, FieldKind] => [f.key as string, f.kind])
    )
    const parsed: Record<string, number> = {}

    for (const [key, raw] of Object.entries(section)) {
      if (typeof raw !== 'string' || raw.trim() === '') continue
      const kind = kindByKey.get(key)
      if (!kind) continue // unknown key from an older schema version — drop it
      const n = kind === 'line' ? parseLine(raw) : parseAmericanOdds(raw)
      if (n !== null) parsed[key] = n
    }

    if (Object.keys(parsed).length > 0) {
      ;(out as Record<string, unknown>)[spec.id] = parsed
    }
  }

  return out
}

/** True when at least one valid value exists across all markets. */
export function hasAnyOdds(odds: FightOddsNumeric): boolean {
  return MARKETS.some((spec) => {
    const section = odds[spec.id] as Record<string, number> | undefined
    return !!section && Object.keys(section).length > 0
  })
}

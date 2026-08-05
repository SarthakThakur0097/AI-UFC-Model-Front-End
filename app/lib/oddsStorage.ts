// oddsStorage.ts — localStorage persistence for hand-entered odds.
//
// BROWSER ONLY. Every entry point guards `typeof window`, so importing this
// from a server module is inert rather than fatal — but don't: the prompt
// builder deliberately has no dependency on it.
//
// One key holds the whole store. A fully-filled 12-fight card is a few KB
// against a ~5 MB budget, and a single key buys atomic versioning, a trivial
// clear/export, and no key-scanning to find orphans.

import { fightKey, mirrorFightOdds, type FightOddsInput, type MarketId } from './odds'

export const ODDS_STORAGE_KEY = 'fightai.odds.v1'
export const ODDS_STORE_VERSION = 1

/** Entries older than this are garbage-collected on load. */
export const STALE_MAX_AGE_DAYS = 60
const STALE_MAX_AGE_MS = STALE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000

export type OddsStoreEntry = {
  /**
   * Orientation at save time. `f1`/`f2` inside `odds` are POSITIONAL, so if the
   * feed later flips which fighter is listed first we must mirror the odds or a
   * saved moneyline silently attaches to the wrong fighter.
   */
  meta: { f1: string; f2: string; event: string; savedAt: number }
  odds: FightOddsInput
  /** Which market sections the user had open. Presentation only. */
  openMarkets?: MarketId[]
  notes?: string
}

export type OddsStore = {
  version: number
  updatedAt: number
  fights: Record<string, OddsStoreEntry>
}

export type LoadResult = {
  store: OddsStore
  /** True when saved data existed but could not be read and was discarded. */
  corrupted: boolean
}

export function emptyStore(): OddsStore {
  return { version: ODDS_STORE_VERSION, updatedAt: 0, fights: {} }
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Structural validation — anything unrecognized is discarded, not migrated. */
function parseStore(raw: string): OddsStore | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isPlainObject(data)) return null
  if (data.version !== ODDS_STORE_VERSION) return null
  if (!isPlainObject(data.fights)) return null

  const fights: Record<string, OddsStoreEntry> = {}
  for (const [key, entry] of Object.entries(data.fights)) {
    if (!isPlainObject(entry)) continue
    const meta = entry.meta
    const odds = entry.odds
    if (!isPlainObject(meta) || !isPlainObject(odds)) continue
    if (typeof meta.f1 !== 'string' || typeof meta.f2 !== 'string') continue
    if (typeof meta.event !== 'string') continue

    fights[key] = {
      meta: {
        f1: meta.f1,
        f2: meta.f2,
        event: meta.event,
        savedAt: typeof meta.savedAt === 'number' ? meta.savedAt : 0,
      },
      odds: odds as FightOddsInput,
      openMarkets: Array.isArray(entry.openMarkets)
        ? (entry.openMarkets.filter((m) => typeof m === 'string') as MarketId[])
        : undefined,
      notes: typeof entry.notes === 'string' ? entry.notes : undefined,
    }
  }

  return {
    version: ODDS_STORE_VERSION,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    fights,
  }
}

export function loadOddsStore(): LoadResult {
  if (typeof window === 'undefined') return { store: emptyStore(), corrupted: false }

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(ODDS_STORAGE_KEY)
  } catch {
    // Private mode / storage disabled — behave as if empty.
    return { store: emptyStore(), corrupted: false }
  }
  if (!raw) return { store: emptyStore(), corrupted: false }

  const parsed = parseStore(raw)
  if (!parsed) return { store: emptyStore(), corrupted: true }
  return { store: parsed, corrupted: false }
}

export function saveOddsStore(store: OddsStore, now: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const payload: OddsStore = { ...store, version: ODDS_STORE_VERSION, updatedAt: now }
    window.localStorage.setItem(ODDS_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    // Quota exceeded or storage disabled. Caller surfaces this to the user
    // rather than pretending the save succeeded.
    return false
  }
}

export function clearOddsStore(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ODDS_STORAGE_KEY)
  } catch {
    /* nothing useful to do */
  }
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Drop entries older than STALE_MAX_AGE_DAYS.
 *
 * This is the ONLY automatic deletion. Deleting entries just because they're
 * absent from the live card would be catastrophic: getUpcomingFights() swallows
 * every error and returns [], so one backend hiccup would wipe a hand-typed
 * card. Age is independent of backend health, so it's safe.
 */
export function pruneStore(store: OddsStore, now: number): OddsStore {
  const fights: Record<string, OddsStoreEntry> = {}
  let dropped = 0
  for (const [key, entry] of Object.entries(store.fights)) {
    const age = now - (entry.meta.savedAt || 0)
    if (entry.meta.savedAt > 0 && age > STALE_MAX_AGE_MS) {
      dropped++
      continue
    }
    fights[key] = entry
  }
  return dropped === 0 ? store : { ...store, fights }
}

export type LiveFightRef = { event: string; f1: string; f2: string }

/**
 * Realign stored odds whose fighter orientation no longer matches the feed.
 *
 * fightKey() sorts the two names so a swap doesn't orphan the entry — but the
 * f1/f2 slots inside the odds object are positional, so they have to be
 * mirrored to match. An inverted moneyline is the worst bug this feature could
 * ship, so this runs on every load.
 */
export function reconcileOrientation(store: OddsStore, live: LiveFightRef[]): OddsStore {
  let changed = false
  const fights = { ...store.fights }

  for (const ref of live) {
    const key = fightKey(ref.event, ref.f1, ref.f2)
    const entry = fights[key]
    if (!entry) continue

    const flipped = entry.meta.f1 !== ref.f1 && entry.meta.f1 === ref.f2
    if (!flipped) continue

    fights[key] = {
      ...entry,
      meta: { ...entry.meta, f1: ref.f1, f2: ref.f2 },
      odds: mirrorFightOdds(entry.odds),
    }
    changed = true
  }

  return changed ? { ...store, fights } : store
}

/** Saved entries that aren't on the live card. Surfaced, never auto-deleted. */
export function staleEntries(
  store: OddsStore,
  live: LiveFightRef[]
): { key: string; entry: OddsStoreEntry }[] {
  const liveKeys = new Set(live.map((r) => fightKey(r.event, r.f1, r.f2)))
  return Object.entries(store.fights)
    .filter(([key]) => !liveKeys.has(key))
    .map(([key, entry]) => ({ key, entry }))
}

export function deleteEntry(store: OddsStore, key: string): OddsStore {
  if (!(key in store.fights)) return store
  const fights = { ...store.fights }
  delete fights[key]
  return { ...store, fights }
}

export function deleteEntries(store: OddsStore, keys: string[]): OddsStore {
  if (keys.length === 0) return store
  const fights = { ...store.fights }
  for (const k of keys) delete fights[k]
  return { ...store, fights }
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

/**
 * Hundreds of hand-typed values living only in one browser's localStorage is a
 * real loss risk (wrong device, cleared site data, incognito). These two are
 * the escape hatch.
 */
export function exportStore(store: OddsStore): string {
  return JSON.stringify(store, null, 2)
}

export function importStore(json: string): OddsStore | null {
  return parseStore(json)
}

/** Merge an imported store into the current one. Imported entries win on conflict. */
export function mergeStores(base: OddsStore, incoming: OddsStore): OddsStore {
  return {
    version: ODDS_STORE_VERSION,
    updatedAt: Math.max(base.updatedAt, incoming.updatedAt),
    fights: { ...base.fights, ...incoming.fights },
  }
}

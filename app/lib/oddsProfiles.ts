// oddsProfiles.ts — fetches fighter profiles (Glicko + performance radar) for
// the odds tab, on demand at prompt-generation time.
//
// These are NOT in /upcoming, so they need one request per fighter. A full card
// list is ~50 fights / ~100 fighters, but the prompt only ever includes fights
// that have odds entered — so fetching eagerly would mean ~100 requests for
// data that mostly never gets used. Instead we fetch only the fighters we're
// about to write into the prompt, deduped by name and memoized for the session.

import type { PromptFighterProfile } from './oddsPrompt'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'

/** Name -> in-flight or settled profile. Survives repeated Generate clicks. */
const cache = new Map<string, Promise<PromptFighterProfile>>()

async function fetchProfile(name: string): Promise<PromptFighterProfile> {
  try {
    const res = await fetch(`${API_URL}/fighter/${encodeURIComponent(name)}/profile`)
    if (!res.ok) return null
    return (await res.json()) as PromptFighterProfile
  } catch {
    // Same convention as the rest of the app: a failed lookup is missing data,
    // not an error. The prompt simply omits the section.
    return null
  }
}

export function getProfile(name: string): Promise<PromptFighterProfile> {
  const hit = cache.get(name)
  if (hit) return hit
  const p = fetchProfile(name)
  cache.set(name, p)
  return p
}

export type FighterPair = { f1: string; f2: string }

/**
 * Resolve profiles for a set of fights. Unique fighters are fetched once each
 * even when they appear on multiple cards.
 *
 * Returns a name -> profile map; callers pair it back up themselves.
 */
export async function getProfilesFor(
  pairs: FighterPair[]
): Promise<Map<string, PromptFighterProfile>> {
  const names = Array.from(new Set(pairs.flatMap((p) => [p.f1, p.f2])))
  const settled = await Promise.all(names.map((n) => getProfile(n)))
  return new Map(names.map((n, i) => [n, settled[i]]))
}

/** Test seam / manual refresh. */
export function clearProfileCache(): void {
  cache.clear()
}

// Recovering the main event of a past card.
//
// `/upcoming` gives every fight a `position`, which is what drives the
// Main / Co-Main / Featured / Prelim tags on the upcoming tab. `/results` does
// NOT carry that field, and the order it returns fights in is arbitrary — each
// pair is also alphabetised by fighter name, so neither the fight order nor the
// corner order reflects the card. Taking `fights[0]` as the main event is wrong
// on 12 of the 20 cards the past tab requests.
//
// The event title is the one place the main event is still recorded:
// "UFC 330: Makhachev vs. Machado Garry". Matching that back onto the fight list
// is a derivation from data the backend does publish, not a guess.
//
// What this CANNOT recover: the rest of the card order. Co-main and prelim
// positions are simply absent from `/results`, so the remaining fights stay in
// arrival order. The real fix is a `position` field on `/results`, in the
// backend repo — this is the honest best effort until that exists.

// Unicode combining diacritical marks, the block NFD splits accents out into.
const COMBINING_FIRST = 0x300
const COMBINING_LAST = 0x36f

/** Strip diacritics and case, so an accent doesn't defeat a surname match. */
function normalize(s: string): string {
  let out = ''
  for (const ch of s.normalize('NFD')) {
    const c = ch.codePointAt(0) as number
    if (c >= COMBINING_FIRST && c <= COMBINING_LAST) continue
    out += ch
  }
  return out.toLowerCase().trim()
}

function words(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean)
}

/**
 * Does a title fragment name this fighter?
 *
 * UFC titles use the family name, so the fragment must align with one END of
 * the full name, on whole-word boundaries:
 *
 *   suffix — "machado garry" matches "Ian Machado Garry", "du plessis" matches
 *            "Dricus Du Plessis" (Western order, family name last)
 *   prefix — "song" matches "Song Yadong", "xiong" matches "Xiong Jingnan"
 *            (Chinese/Korean order, family name first). Suffix-only matching
 *            silently missed every one of these.
 *
 * Word-aligned rather than `includes`, so "Silva" cannot match "Silvana". A
 * fragment that lands on the wrong end of some unrelated fighter is caught by
 * the caller, which requires both title names to hit the same single fight.
 */
function namesFighter(fragment: string, fighter: string): boolean {
  const frag = words(fragment)
  const full = words(fighter)
  if (frag.length === 0 || frag.length > full.length) return false
  const matchesAt = (offset: number) => frag.every((w, i) => full[offset + i] === w)
  return matchesAt(0) || matchesAt(full.length - frag.length)
}

/**
 * Pull the two sides out of an event title, or null when it names no matchup.
 *
 * "UFC 330: Makhachev vs. Machado Garry" -> ["Makhachev", "Machado Garry"]
 * "UFC 329: McGregor vs. Holloway 2"     -> ["McGregor", "Holloway"]
 * "UFC Freedom 250"                      -> null
 */
export function parseTitleMatchup(title: string): [string, string] | null {
  if (!title) return null
  // Everything after the series prefix, when there is one. Titles without a
  // colon are still worth trying — some are just "A vs. B".
  const colon = title.lastIndexOf(': ')
  const matchup = colon === -1 ? title : title.slice(colon + 2)
  const parts = matchup.split(/\s+vs\.?\s+/i)
  if (parts.length !== 2) return null
  // A rematch ordinal belongs to the event, not the fighter: "Holloway 2".
  const clean = (s: string) => s.replace(/\s+(?:\d+|I{2,3})$/, '').trim()
  const a = clean(parts[0])
  const b = clean(parts[1])
  if (!a || !b) return null
  return [a, b]
}

export type OrderedCard<F> = {
  fights: F[]
  /**
   * False when the title named no matchup, or named one that matches zero or
   * several fights. Callers must not badge any fight as the main event in that
   * case — an arbitrary fight wearing a MAIN EVENT badge is the bug this
   * module exists to fix, and guessing again would just move it.
   */
  mainEventKnown: boolean
}

/**
 * Hoist the title's matchup to the front of the fight list.
 *
 * Corner order within the fight is deliberately left alone. The alphabetised
 * f1/f2 that `/results` returns is paired with f1_prob/f2_prob,
 * method_per_fighter, market_f1/f2 and market_props, all of which are oriented
 * to it consistently (verified across the live payload). Swapping the names
 * here without swapping all of those in lockstep would invert real numbers,
 * so the main event may read with its corners reversed relative to the title.
 */
export function orderPastCard<F extends { f1: string; f2: string }>(
  eventTitle: string,
  fights: F[]
): OrderedCard<F> {
  const matchup = parseTitleMatchup(eventTitle)
  if (!matchup || fights.length === 0) {
    return { fights, mainEventKnown: false }
  }
  const [a, b] = matchup

  const hits = fights.filter(
    (f) =>
      (namesFighter(a, f.f1) && namesFighter(b, f.f2)) ||
      (namesFighter(a, f.f2) && namesFighter(b, f.f1))
  )
  // Exactly one, or we don't know. Two fighters sharing a surname on the same
  // card would otherwise let us promote the wrong bout with full confidence.
  if (hits.length !== 1) {
    return { fights, mainEventKnown: false }
  }

  const main = hits[0]
  return {
    fights: [main, ...fights.filter((f) => f !== main)],
    mainEventKnown: true,
  }
}

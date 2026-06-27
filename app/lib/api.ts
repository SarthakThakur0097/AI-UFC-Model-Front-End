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

export async function getAccuracy() {
  try {
    const res = await fetch(`${API_URL}/accuracy`, { cache: 'no-store' })
    return res.json()
  } catch {
    return null
  }
}

export async function getPastCards(limit = 3) {
  try {
    const res = await fetch(`${API_URL}/results?limit=${limit}`, {
      cache: 'no-store'
    })
    return res.json()
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
  // prediction fields (precomputed; may be absent if the pipeline hasn't run)
  pick?: string
  conf?: number
  f1Prob?: number
  f2Prob?: number
  method?: { Decision: number; 'KO/TKO': number; Submission: number; pick: string }
  methodPerFighter?: MethodPerFighterData | null
  commonOpponents?: { common: any[]; count: number } | null
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
        method?: { Decision: number; 'KO/TKO': number; Submission: number; pick: string }
        method_per_fighter?: MethodPerFighterData | null
        common_opponents?: { common: any[]; count: number } | null
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
          // carry predictions straight through (already computed server-side)
          pick: f.pick,
          conf: f.confidence,
          f1Prob: f.f1_prob,
          f2Prob: f.f2_prob,
          method: f.method,
          methodPerFighter: f.method_per_fighter ?? null,
          commonOpponents: f.common_opponents ?? null,
          error: f.error ?? (f.pick === undefined),
        })
      }
    }
    return flat
  } catch {
    return []
  }
}
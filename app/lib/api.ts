const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'

export async function getPrediction(f1: string, f2: string) {
  try {
    const res = await fetch(
      `${API_URL}/predict/full?f1=${encodeURIComponent(f1)}&f2=${encodeURIComponent(f2)}`,
      { next: { revalidate: 3600 } }
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
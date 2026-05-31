const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'

export async function getPrediction(f1: string, f2: string) {
  try {
    const [win, method] = await Promise.all([
      fetch(`${API_URL}/predict?f1=${encodeURIComponent(f1)}&f2=${encodeURIComponent(f2)}`, 
        { cache: 'no-store' }).then(r => r.json()),
      fetch(`${API_URL}/predict/method?f1=${encodeURIComponent(f1)}&f2=${encodeURIComponent(f2)}`,
        { cache: 'no-store' }).then(r => r.json()),
    ])

    return {
      f1: win.f1,
      f2: win.f2,
      pick: win.pick,
      conf: win.confidence,
      f1Prob: win.f1_prob,
      f2Prob: win.f2_prob,
      error: false,
      method: {
        Decision: method.Decision,
        'KO/TKO': method['KO/TKO'],
        Submission: method.Submission,
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
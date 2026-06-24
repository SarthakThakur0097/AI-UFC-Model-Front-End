// fights.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

export type UpcomingFight = {
  event: string;
  date: string;
  tag: string;
  tagColor: string;
  f1: string;
  f1Record: string;
  f2: string;
  f2Record: string;
};

// derive Main / Co-Main / Featured / Prelim from card position
function positionToTag(pos: number, total: number): { tag: string; tagColor: string } {
  if (pos === 0) return { tag: "Main", tagColor: "text-blue-400" };
  if (pos === 1) return { tag: "Co-Main", tagColor: "text-blue-400" };
  if (pos <= 4) return { tag: "Featured", tagColor: "text-blue-400" };
  return { tag: "Prelim", tagColor: "text-gray-400" };
}

// "2026-06-27" + location -> "Jun 27, 2026 · Baku, Azerbaijan"
function formatDate(iso: string, location: string): string {
  const d = new Date(iso + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const dateStr = isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", opts);
  return location ? `${dateStr} · ${location}` : dateStr;
}

export async function fetchUpcomingFights(): Promise<UpcomingFight[]> {
  try {
    const res = await fetch(`${API_URL}/upcoming`);
    if (!res.ok) return [];
    const events: {
      event: string;
      date: string;
      location: string;
      fights: { f1: string; f2: string; weight_class: string; position: number }[];
    }[] = await res.json();

    // flatten grouped events -> flat fight list (matching old shape)
    const flat: UpcomingFight[] = [];
    for (const ev of events) {
      const total = ev.fights.length;
      for (const f of ev.fights) {
        const { tag, tagColor } = positionToTag(f.position, total);
        flat.push({
          event: ev.event,
          date: formatDate(ev.date, ev.location),
          tag,
          tagColor,
          f1: f.f1,
          f1Record: "",
          f2: f.f2,
          f2Record: "",
        });
      }
    }
    return flat;
  } catch {
    return [];
  }
}
"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type RatingResp = {
  name: string;
  rating: number;
  percentile: number | null;
};

// Read glicko from the unified /profile endpoint (cached). Replaces the old
// per-fighter /glicko call. event_id (optional) selects a fight-time snapshot.
async function fetchRating(
  name: string,
  eventId?: string,
): Promise<RatingResp | null> {
  try {
    const ev = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";
    const res = await fetch(
      `${API_URL}/fighter/${encodeURIComponent(name)}/profile${ev}`,
    );
    if (!res.ok) return null;
    const prof = await res.json();
    if (!prof.glicko) return null;
    return {
      name: prof.name,
      rating: prof.glicko.rating,
      percentile: prof.glicko.percentile,
    };
  } catch {
    return null;
  }
}

function pctLabel(p: number | null): string {
  if (p === null) return "";
  if (p >= 99) return "top 1%";
  if (p >= 90) return `top ${Math.round(100 - p)}%`;
  return `${p}th pct`;
}

function RatingBlock({
  data,
  align,
  color,
}: {
  data: RatingResp | null;
  align: "left" | "right";
  color: string;
}) {
  if (!data)
    return (
      <div style={{ flex: 1, textAlign: align }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
      </div>
    );
  return (
    <div style={{ flex: 1, textAlign: align }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.1 }}>
        {data.rating}
      </div>
      <div
        style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}
      >
        {pctLabel(data.percentile)}
      </div>
    </div>
  );
}

export default function FighterRating({
  f1,
  f2,
  eventId,
}: {
  f1: string;
  f2: string;
  eventId?: string;
}) {
  const [a, setA] = useState<RatingResp | null>(null);
  const [b, setB] = useState<RatingResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchRating(f1, eventId), fetchRating(f2, eventId)]).then(
      ([ra, rb]) => {
        if (!alive) return;
        setA(ra);
        setB(rb);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [f1, f2, eventId]);

  if (loading)
    return (
      <p
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-secondary)",
          padding: "8px 0",
        }}
      >
        Loading ratings…
      </p>
    );

  const aHigher = a && b ? a.rating >= b.rating : false;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <RatingBlock
        data={a}
        align="left"
        color={aHigher ? "var(--matrix-green)" : "var(--text-primary)"}
      />
      <div
        style={{
          fontSize: 9,
          letterSpacing: "1px",
          color: "var(--text-muted)",
          textAlign: "center",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        Fighter
        <br />
        Rating
      </div>
      <RatingBlock
        data={b}
        align="right"
        color={
          !aHigher && a && b ? "var(--matrix-green)" : "var(--text-primary)"
        }
      />
    </div>
  );
}

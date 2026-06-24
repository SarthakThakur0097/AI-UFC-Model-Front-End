"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type RatingResp = {
  name: string;
  rating: number;
  rd: number;
  percentile: number | null;
};

async function fetchRating(name: string): Promise<RatingResp | null> {
  try {
    const res = await fetch(
      `${API_URL}/fighter/${encodeURIComponent(name)}/glicko`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pctLabel(p: number | null): string {
  if (p === null) return "";
  if (p >= 99) return "top 1%";
  if (p >= 90) return `top ${Math.round(100 - p)}%`;
  if (p >= 50) return `${p}th pct`;
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
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
        {pctLabel(data.percentile)}
      </div>
    </div>
  );
}

export default function FighterRating({
  f1,
  f2,
}: {
  f1: string;
  f2: string;
}) {
  const [a, setA] = useState<RatingResp | null>(null);
  const [b, setB] = useState<RatingResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchRating(f1), fetchRating(f2)]).then(([ra, rb]) => {
      if (!alive) return;
      setA(ra);
      setB(rb);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2]);

  if (loading)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", padding: "8px 0" }}>
        Loading ratings…
      </p>
    );

  // which side is stronger — subtle highlight
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
        color={!aHigher && a && b ? "var(--matrix-green)" : "var(--text-primary)"}
      />
    </div>
  );
}
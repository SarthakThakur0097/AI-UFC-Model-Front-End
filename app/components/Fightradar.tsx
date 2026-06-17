"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

// axis order + short display labels (must match backend RADAR_STATS keys)
const AXES: { key: string; label: string }[] = [
  { key: "slpm", label: "Striking\nVolume" },
  { key: "str_acc", label: "Striking\nAccuracy" },
  { key: "str_def", label: "Striking\nDefense" },
  { key: "td_avg", label: "TD / 15" },
  { key: "td_acc", label: "TD\nAccuracy" },
  { key: "td_def", label: "TD\nDefense" },
  { key: "sub_avg", label: "Sub / 15" },
];

type RadarResp = {
  name: string;
  stats: Record<string, { raw: number; pct: number; label: string }>;
};

async function fetchRadar(name: string): Promise<RadarResp | null> {
  try {
    const res = await fetch(
      `${API_URL}/fighter/${encodeURIComponent(name)}/radar`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function polygon(vals: number[], R: number, cx: number, cy: number) {
  const n = AXES.length;
  let p = "";
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (R * vals[i]) / 100;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    p += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return p + "Z";
}

export default function FightRadar({
  f1,
  f2,
}: {
  f1: string;
  f2: string;
}) {
  const [a, setA] = useState<RadarResp | null>(null);
  const [b, setB] = useState<RadarResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchRadar(f1), fetchRadar(f2)]).then(([ra, rb]) => {
      if (!alive) return;
      if (!ra || !rb) {
        setFailed(true);
      } else {
        setA(ra);
        setB(rb);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2]);

  if (loading)
    return (
      <p
        style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", padding: "20px 0" }}
      >
        Loading radar…
      </p>
    );
  if (failed || !a || !b)
    return (
      <p
        style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", padding: "20px 0" }}
      >
        Radar unavailable for this matchup
      </p>
    );

  const valsA = AXES.map((ax) => a.stats[ax.key]?.pct ?? 0);
  const valsB = AXES.map((ax) => b.stats[ax.key]?.pct ?? 0);

  const size = 300;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 95;
  const n = AXES.length;

  const ringPath = (frac: number) => {
    let p = "";
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + Math.cos(ang) * R * frac;
      const y = cy + Math.sin(ang) * R * frac;
      p += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return p + "Z";
  };

  const spokes: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + Math.cos(ang) * R;
    const y = cy + Math.sin(ang) * R;
    spokes.push(
      <line
        key={`s${i}`}
        x1={cx}
        y1={cy}
        x2={x.toFixed(1)}
        y2={y.toFixed(1)}
        stroke="rgba(0,255,102,0.10)"
      />
    );
    const lx = cx + Math.cos(ang) * (R + 20);
    const ly = cy + Math.sin(ang) * (R + 20);
    const lines = AXES[i].label.split("\n");
    const anchor =
      Math.abs(Math.cos(ang)) < 0.3
        ? "middle"
        : Math.cos(ang) > 0
        ? "start"
        : "end";
    lines.forEach((ln, j) => {
      labels.push(
        <text
          key={`l${i}-${j}`}
          x={lx.toFixed(1)}
          y={(ly + j * 9 - (lines.length - 1) * 4).toFixed(1)}
          textAnchor={anchor}
          fontSize="9"
          fill="#5f8f73"
          fontFamily="'Courier New', monospace"
        >
          {ln}
        </text>
      );
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginBottom: 4,
          fontSize: 12,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ff3b5c",
              display: "inline-block",
            }}
          />
          {a.name}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#39c0ff",
              display: "inline-block",
            }}
          />
          {b.name}
        </span>
      </div>
      <svg
        width={size}
        height={size + 10}
        viewBox={`0 0 ${size} ${size + 10}`}
        style={{ display: "block", margin: "0 auto" }}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <path
            key={`r${f}`}
            d={ringPath(f)}
            fill="none"
            stroke="rgba(0,255,102,0.10)"
          />
        ))}
        {spokes}
        <path
          d={polygon(valsB, R, cx, cy)}
          fill="#39c0ff22"
          stroke="#39c0ff"
          strokeWidth="2"
        />
        <path
          d={polygon(valsA, R, cx, cy)}
          fill="#ff3b5c22"
          stroke="#ff3b5c"
          strokeWidth="2"
        />
        {labels}
      </svg>
    </div>
  );
}
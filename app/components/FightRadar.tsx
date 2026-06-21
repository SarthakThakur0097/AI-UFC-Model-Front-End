"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type Mode = "discipline" | "raw" | "adjusted" | "defense";

// ── axis sets per mode (names MUST match backend stat keys) ──
const AXES_DISCIPLINE = ["Striking", "Power", "Wrestling", "Control", "BJJ"];

const AXES_DEFENSE = [
  "Striking Defense",
  "Takedown Defense",
  "Durability",
  "Ground Defense",
  "Distance Defense",
];

const AXES_RAW: { key: string; label: string }[] = [
  { key: "slpm", label: "Striking\nVolume" },
  { key: "str_acc", label: "Striking\nAccuracy" },
  { key: "str_def", label: "Striking\nDefense" },
  { key: "td_avg", label: "TD / 15" },
  { key: "td_acc", label: "TD\nAccuracy" },
  { key: "td_def", label: "TD\nDefense" },
  { key: "sub_avg", label: "Sub / 15" },
];

const AXES_ADJ: { key: string; label: string }[] = [
  { key: "slpm", label: "Striking\nVolume" },
  { key: "str_acc", label: "Striking\nAccuracy" },
  { key: "td_avg", label: "Takedowns" },
  { key: "td_acc", label: "TD\nAccuracy" },
  { key: "sub_avg", label: "Submission" },
  { key: "ctrl_time_per_min", label: "Control" },
  { key: "kd_per_min", label: "Knockdown\nPower" },
  { key: "ground_allowed", label: "Ground\nDefense" },
  { key: "distance_allowed", label: "Distance\nDefense" },
];

// labels for radar display — wrap multi-word axis names onto two lines
function wrapLabel(s: string): string {
  if (s.includes("\n")) return s;
  const parts = s.split(" ");
  if (parts.length === 2) return parts.join("\n");
  return s;
}

async function fetchRadar(name: string, mode: Mode): Promise<any | null> {
  const path =
    mode === "discipline"
      ? "radar_discipline"
      : mode === "defense"
        ? "radar_defense"
        : mode === "adjusted"
          ? "radar_adj"
          : "radar";
  try {
    const res = await fetch(
      `${API_URL}/fighter/${encodeURIComponent(name)}/${path}`,
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function polygon(vals: number[], R: number, cx: number, cy: number, n: number) {
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

function valsFor(mode: Mode, resp: any): number[] {
  if (!resp) return [];
  if (mode === "discipline")
    return AXES_DISCIPLINE.map((ax) => resp.stats[ax] ?? 0);
  if (mode === "defense") return AXES_DEFENSE.map((ax) => resp.stats[ax] ?? 0);
  const axes = mode === "adjusted" ? AXES_ADJ : AXES_RAW;
  return axes.map((ax) => resp.stats[ax.key]?.pct ?? 0);
}

function labelsFor(mode: Mode): string[] {
  if (mode === "discipline") return AXES_DISCIPLINE.map(wrapLabel);
  if (mode === "defense") return AXES_DEFENSE.map(wrapLabel);
  return (mode === "adjusted" ? AXES_ADJ : AXES_RAW).map((a) => a.label);
}

export default function FightRadar({ f1, f2 }: { f1: string; f2: string }) {
  const [mode, setMode] = useState<Mode>("discipline");
  const [a, setA] = useState<any | null>(null);
  const [b, setB] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([fetchRadar(f1, mode), fetchRadar(f2, mode)]).then(
      ([ra, rb]) => {
        if (!alive) return;
        if (!ra || !rb) setFailed(true);
        else {
          setA(ra);
          setB(rb);
        }
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [f1, f2, mode]);

  const MODES: { label: string; val: Mode }[] = [
    { label: "Discipline", val: "discipline" },
    { label: "Raw", val: "raw" },
    { label: "Adjusted", val: "adjusted" },
    { label: "Defense", val: "defense" },
  ];

  const toggle = (
    <div
      style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}
    >
      {MODES.map((opt, i) => (
        <button
          key={opt.val}
          onClick={() => setMode(opt.val)}
          style={{
            fontSize: 10,
            letterSpacing: "0.5px",
            padding: "5px 10px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            textTransform: "uppercase",
            border: "1px solid var(--border)",
            borderLeft: i === 0 ? "1px solid var(--border)" : "none",
            borderRadius:
              i === 0
                ? "5px 0 0 5px"
                : i === MODES.length - 1
                  ? "0 5px 5px 0"
                  : "0",
            background:
              mode === opt.val ? "rgba(0,255,102,0.15)" : "transparent",
            color:
              mode === opt.val
                ? "var(--matrix-green)"
                : "var(--text-secondary)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (loading)
    return (
      <div>
        {toggle}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#5f8f73",
            padding: "20px 0",
          }}
        >
          Loading radar…
        </p>
      </div>
    );

  if (failed || !a || !b)
    return (
      <div>
        {toggle}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#5f8f73",
            padding: "20px 0",
          }}
        >
          Radar unavailable for this matchup
        </p>
      </div>
    );

  if (mode === "adjusted" && (a.limited || b.limited))
    return (
      <div>
        {toggle}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#5f8f73",
            padding: "20px 0",
          }}
        >
          Limited adjusted data for this matchup
        </p>
      </div>
    );

  const labels = labelsFor(mode);
  const n = labels.length;
  const valsA = valsFor(mode, a);
  const valsB = valsFor(mode, b);

  const size = 300;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 92;

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
  const labelEls: React.ReactElement[] = [];
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
      />,
    );
    const lx = cx + Math.cos(ang) * (R + 22);
    const ly = cy + Math.sin(ang) * (R + 22);
    const lines = labels[i].split("\n");
    const anchor =
      Math.abs(Math.cos(ang)) < 0.3
        ? "middle"
        : Math.cos(ang) > 0
          ? "start"
          : "end";
    lines.forEach((ln, j) => {
      labelEls.push(
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
        </text>,
      );
    });
  }

  // widened canvas so left/right labels never clip
  const padX = 70;

  return (
    <div>
      {toggle}
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
        width={size + padX * 2}
        height={size + 10}
        viewBox={`${-padX} 0 ${size + padX * 2} ${size + 10}`}
        style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
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
          d={polygon(valsB, R, cx, cy, n)}
          fill="#39c0ff22"
          stroke="#39c0ff"
          strokeWidth="2"
        />
        <path
          d={polygon(valsA, R, cx, cy, n)}
          fill="#ff3b5c22"
          stroke="#ff3b5c"
          strokeWidth="2"
        />
        {labelEls}
      </svg>
      {mode === "discipline" && (
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#3a5c47",
            marginTop: 6,
          }}
        >
          MMA skill profile — percentile vs all fighters
        </p>
      )}
      {mode === "defense" && (
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#3a5c47",
            marginTop: 6,
          }}
        >
          Defensive profile — higher = harder to hit / finish
        </p>
      )}
      {mode === "adjusted" && (
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#3a5c47",
            marginTop: 6,
          }}
        >
          Opponent-adjusted percentile vs division
        </p>
      )}
    </div>
  );
}

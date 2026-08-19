"use client";

import { useEffect, useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type Mode = "discipline" | "raw" | "adjusted" | "defense";

function wrapLabel(s: string): string {
  if (s.includes("\n")) return s;
  const parts = s.split(" ");
  if (parts.length === 2) return parts.join("\n");
  return s;
}

// ── axis sets per mode (keys MUST match backend stat keys) ──
type AxisSpec = { key: string; label: string };

const disciplineAxis = (k: string): AxisSpec => ({ key: k, label: wrapLabel(k) });

const AXES_DISCIPLINE: AxisSpec[] = [
  "Striking",
  "Power",
  "Wrestling",
  "Control",
  "BJJ",
].map(disciplineAxis);

const AXES_DEFENSE: AxisSpec[] = [
  "Striking Defense",
  "Takedown Defense",
  "Durability",
  "Ground Defense",
  "Distance Defense",
].map(disciplineAxis);

const AXES_RAW: AxisSpec[] = [
  { key: "slpm", label: "Striking\nVolume" },
  { key: "str_acc", label: "Striking\nAccuracy" },
  { key: "str_def", label: "Striking\nDefense" },
  { key: "td_avg", label: "TD / 15" },
  { key: "td_acc", label: "TD\nAccuracy" },
  { key: "td_def", label: "TD\nDefense" },
  { key: "sub_avg", label: "Sub / 15" },
];

const AXES_ADJ: AxisSpec[] = [
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

// ── profile shape returned by /fighter/<name>/profile ──
// Two wire shapes: `discipline`/`defense` are flat name -> number|null dicts,
// `adjusted`/`raw` are name -> {z, pct, label} with pct nullable.
type AdjStat = {
  z?: number | null;
  pct?: number | null;
  label?: string | null;
};
type RadarModeData = {
  name: string;
  stats: Record<string, number | AdjStat | null> | null;
  limited?: boolean;
};
type Profile = {
  name: string;
  glicko: { rating: number; percentile: number | null } | null;
  radar: {
    discipline: RadarModeData | null;
    defense: RadarModeData | null;
    adjusted: RadarModeData | null;
    raw: RadarModeData | null;
  };
};

// Fetch a fighter's FULL profile once (all radar modes + glicko), from cache.
// event_id (optional) selects a fight-time snapshot for past cards.
async function fetchProfile(
  name: string,
  eventId?: string,
): Promise<Profile | null> {
  try {
    const ev = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";
    const res = await fetch(
      `${API_URL}/fighter/${encodeURIComponent(name)}/profile${ev}`,
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

function axesFor(mode: Mode): AxisSpec[] {
  if (mode === "discipline") return AXES_DISCIPLINE;
  if (mode === "defense") return AXES_DEFENSE;
  return mode === "adjusted" ? AXES_ADJ : AXES_RAW;
}

/**
 * Read one axis off a fighter's profile, preserving "no value".
 *
 * A null here is NOT a zero. The backend suppresses a metric it cannot compute
 * (adjusted Control, for instance, is gated behind takedown rate, so a striker
 * who never shoots has none) precisely so the number is not published. Coercing
 * it to 0 puts that fighter at worst-in-division on a skill that was never
 * measured — the exact misreading the suppression exists to prevent. A real 0
 * (Njokuani's discipline Wrestling, raw TD Accuracy) is a number and survives.
 */
function readAxis(
  mode: Mode,
  profile: Profile | null,
  key: string,
): number | null {
  const stats = profile?.radar[mode]?.stats;
  if (!stats) return null;
  const raw = stats[key];
  if (raw === null || raw === undefined) return null;
  const v = typeof raw === "number" ? raw : raw.pct;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Axis label for prose — the chart's labels carry a hard wrap. */
const flatLabel = (s: string) => s.replace(/\n/g, " ");

const MODE_NOUN: Record<Mode, string> = {
  discipline: "discipline",
  adjusted: "opponent-adjusted",
  defense: "defense",
  raw: "raw",
};

// A radar needs at least three spokes to enclose an area; one or two would draw
// a point or a line, which reads as "no ability" rather than "no data".
const MIN_AXES = 3;

export default function FightRadar({
  f1,
  f2,
  eventId,
}: {
  f1: string;
  f2: string;
  eventId?: string;
}) {
  const [mode, setMode] = useState<Mode>("discipline");
  const [a, setA] = useState<Profile | null>(null);
  const [b, setB] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Fetch BOTH fighters' full profiles ONCE (not per mode). Mode switching is
  // now instant — it just reads a different slice of already-fetched data.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([fetchProfile(f1, eventId), fetchProfile(f2, eventId)]).then(
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
  }, [f1, f2, eventId]);

  // ── momentum rotation (drag to spin, flick for inertia) ──
  const [rot, setRot] = useState(0);
  const dragRef = useRef<{
    dragging: boolean;
    lastX: number;
    lastT: number;
    vel: number;
    raf: number | null;
  }>({ dragging: false, lastX: 0, lastT: 0, vel: 0, raf: null });

  const onPointerDown = (e: React.PointerEvent) => {
    const d = dragRef.current;
    d.dragging = true;
    d.lastX = e.clientX;
    d.lastT = performance.now();
    d.vel = 0;
    if (d.raf) cancelAnimationFrame(d.raf);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    const dt = Math.max(1, now - d.lastT);
    const dRot = dx * 0.6; // degrees per pixel — responsive drag
    d.vel = dRot / dt; // degrees per ms, for inertia
    d.lastX = e.clientX;
    d.lastT = now;
    setRot((r) => r + dRot);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    // inertia: keep spinning, decaying, until it slows to a stop
    let v = d.vel * 16; // degrees per frame (~16ms)
    const decay = 0.95;
    const step = () => {
      v *= decay;
      setRot((r) => r + v);
      if (Math.abs(v) > 0.05) {
        d.raf = requestAnimationFrame(step);
      } else {
        d.raf = null;
      }
    };
    d.raf = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf);
    };
  }, []);

  const MODES: { label: string; val: Mode }[] = [
    { label: "Discipline", val: "discipline" },
    { label: "Adjusted", val: "adjusted" },
    { label: "Defense", val: "defense" },
    { label: "Raw", val: "raw" },
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
            fontFamily: "var(--font-mono)",
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
              mode === opt.val ? "var(--accent-soft-2)" : "transparent",
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
            color: "var(--text-secondary)",
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
            color: "var(--text-secondary)",
            padding: "20px 0",
          }}
        >
          Radar unavailable for this matchup
        </p>
      </div>
    );

  // Resolve every axis for both corners, keeping nulls as nulls.
  //
  // An axis is comparable only when BOTH fighters have a published value: the
  // user reads the gap between the two polygons as a skill difference, so a
  // spoke where one side is simply unmeasured cannot be drawn at all. Drop it
  // and shrink the radar — a 6-axis shape against a 6-axis shape is honest, a
  // 9-axis shape against a 6-axis one is not.
  const cells = axesFor(mode).map((ax) => ({
    ax,
    va: readAxis(mode, a, ax.key),
    vb: readAxis(mode, b, ax.key),
  }));
  type Cell = (typeof cells)[number];
  const shown = cells.filter(
    (c): c is Cell & { va: number; vb: number } =>
      c.va !== null && c.vb !== null,
  );
  const dropped = cells.filter((c) => c.va === null || c.vb === null);

  // Per fighter, which axes the backend declined to publish. `limited` is NOT
  // consulted: it is all-or-nothing (true only when all nine adjusted axes are
  // null), so a quarter of fighters carry limited:false while part of the chart
  // is missing. The individual nulls are the only source of truth — a
  // limited:true fighter falls out of this same check with every axis missing.
  const missing = [
    { name: a.name, axes: cells.filter((c) => c.va === null) },
    { name: b.name, axes: cells.filter((c) => c.vb === null) },
  ].filter((m) => m.axes.length > 0);

  if (shown.length < MIN_AXES)
    return (
      <div>
        {toggle}
        <div style={{ padding: "18px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {shown.length === 0
              ? `No comparable ${MODE_NOUN[mode]} axes for this matchup.`
              : `Only ${shown.length} comparable ${MODE_NOUN[mode]} ${
                  shown.length === 1 ? "axis" : "axes"
                } — too few to draw a radar.`}
          </p>
          {missing.map((m) => (
            <p
              key={m.name}
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 6,
              }}
            >
              {m.name} —{" "}
              {m.axes.length === cells.length
                ? `no ${MODE_NOUN[mode]} score on any axis`
                : `no ${MODE_NOUN[mode]} score on ${m.axes
                    .map((c) => flatLabel(c.ax.label))
                    .join(", ")}`}
              .
            </p>
          ))}
          <p
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              marginTop: 10,
              fontStyle: "italic",
            }}
          >
            These metrics are unpublished, not zero — plotting them would put
            the fighter at the bottom of a division on a skill never measured.
          </p>
        </div>
      </div>
    );

  const labels = shown.map((c) => c.ax.label);
  const n = labels.length;
  const valsA = shown.map((c) => c.va);
  const valsB = shown.map((c) => c.vb);

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

  // spokes are drawn inside the rotating <g>; labels are drawn OUTSIDE it so
  // they stay upright, but positioned at the ROTATED angle so they orbit with
  // their spoke. rotRad converts the rotation (deg) to radians.
  const rotRad = (rot * Math.PI) / 180;
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
        stroke="rgba(93,202,165,0.12)"
      />,
    );
    // label sits at the rotated angle (orbits) but text itself stays upright
    const langle = ang + rotRad;
    const lx = cx + Math.cos(langle) * (R + 22);
    const ly = cy + Math.sin(langle) * (R + 22);
    const lines = labels[i].split("\n");
    const anchor =
      Math.abs(Math.cos(langle)) < 0.3
        ? "middle"
        : Math.cos(langle) > 0
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
          fill="#7a8580"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          {ln}
        </text>,
      );
    });
  }

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
              background: "var(--f1-color)",
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
              background: "var(--f2-color)",
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
        style={{
          display: "block",
          margin: "0 auto",
          maxWidth: "100%",
          cursor: dragRef.current.dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* rotating group: rings, spokes, polygons spin together */}
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <path
              key={`r${f}`}
              d={ringPath(f)}
              fill="none"
              stroke="rgba(93,202,165,0.12)"
            />
          ))}
          {spokes}
          {/* style, not attributes: CSS vars don't resolve in SVG
              presentation attributes */}
          <path
            d={polygon(valsB, R, cx, cy, n)}
            style={{ fill: "var(--f2-fill)", stroke: "var(--f2-color)" }}
            strokeWidth="2"
          />
          <path
            d={polygon(valsA, R, cx, cy, n)}
            style={{ fill: "var(--f1-fill)", stroke: "var(--f1-color)" }}
            strokeWidth="2"
          />
        </g>
        {/* labels stay OUTSIDE the rotating group so they remain upright */}
        {labelEls}
      </svg>
      {/* Dropped axes are named, never silently omitted — a shrunken radar with
          no explanation reads as the fighter's whole profile. */}
      {dropped.length > 0 && (
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "var(--text-muted)",
            marginTop: 6,
            padding: "0 8px",
          }}
        >
          Not shown — no comparable data:{" "}
          {dropped.map((c) => flatLabel(c.ax.label)).join(", ")}.
        </p>
      )}
      {mode === "discipline" && (
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "var(--text-muted)",
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
            color: "var(--text-muted)",
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
            color: "var(--text-muted)",
            marginTop: 6,
          }}
        >
          Opponent-adjusted percentile vs division
        </p>
      )}
    </div>
  );
}

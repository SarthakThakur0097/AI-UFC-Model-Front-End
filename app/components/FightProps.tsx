"use client";

import { useEffect, useState } from "react";
import {
  complement,
  fetchFightProps,
  lastNameOf,
  pct,
  positionWithin,
  type FightProps as FightPropsData,
  type FighterProps,
  type PropsFailure,
} from "../lib/props";

/**
 * Props are shown as soon as a fight is expanded — there is no second toggle to
 * find. The fetch is still lazy: this component only mounts when the fight's
 * detail panel is open, so browsing the card costs nothing.
 */
type FightPropsProps = {
  f1: string;
  f2: string;
};

const label = { fontSize: 11, color: "var(--text-secondary)" } as const;

/** Duration markets: one labelled bar each. */
function DurationBar({ name, p }: { name: string; p: number }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span style={label}>{name}</span>
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {pct(p)}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 5, background: "rgba(0,255,102,0.10)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, p * 100))}%`,
            background: "var(--matrix-green)",
            boxShadow: "0 0 6px var(--matrix-green)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Projected significant strikes as a q10–q90 range with the median marked.
 * A bar rather than a number because the spread is the point — a wide range is
 * the model saying it doesn't know.
 */
function StrikeRange({ name, s }: { name: string; s: FighterProps["strikes"] }) {
  const markers: { key: keyof typeof s; strong: boolean }[] = [
    { key: "q25", strong: false },
    { key: "q50", strong: true },
    { key: "q75", strong: false },
  ];
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="truncate" style={label} title={name}>
          {name}
        </span>
        <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>
          {Math.round(s.q50)} median
        </span>
      </div>
      <div style={{ position: "relative", height: 18 }}>
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 0,
            right: 0,
            height: 5,
            borderRadius: 3,
            background: "rgba(0,255,102,0.10)",
          }}
        />
        {/* q25–q75 interquartile band */}
        <div
          style={{
            position: "absolute",
            top: 6,
            height: 5,
            borderRadius: 3,
            left: `${positionWithin(s.q25, s.q10, s.q90)}%`,
            width: `${positionWithin(s.q75, s.q10, s.q90) - positionWithin(s.q25, s.q10, s.q90)}%`,
            background: "var(--matrix-green-dim)",
          }}
        />
        {markers.map((m) => (
          <div
            key={m.key}
            title={`${m.key} ${Math.round(s[m.key])}`}
            style={{
              position: "absolute",
              top: m.strong ? 3 : 5,
              left: `calc(${positionWithin(s[m.key], s.q10, s.q90)}% - ${m.strong ? 4 : 2}px)`,
              width: m.strong ? 8 : 4,
              height: m.strong ? 11 : 7,
              borderRadius: m.strong ? 4 : 2,
              background: m.strong ? "var(--matrix-green)" : "var(--text-muted)",
              boxShadow: m.strong ? "0 0 6px var(--matrix-green)" : "none",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        <span>{Math.round(s.q10)}</span>
        <span>{Math.round(s.q90)}</span>
      </div>
    </div>
  );
}

function TakedownChips({ name, t }: { name: string; t: FighterProps["takedowns"] }) {
  const chips = [
    { k: "1+ TD", p: t.p_ge1 },
    { k: "2+", p: t.p_ge2 },
    { k: "3+", p: t.p_ge3 },
  ];
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="truncate" style={{ ...label, width: 96 }} title={name}>
        {name}
      </span>
      {chips.map((c) => {
        // Highlight a genuinely likely takedown rather than every chip.
        const strong = c.p > 0.6;
        return (
          <span
            key={c.k}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: strong ? "rgba(0,255,102,0.12)" : "transparent",
              border: `1px solid ${strong ? "var(--matrix-green)" : "var(--border)"}`,
              color: strong ? "var(--matrix-green)" : "var(--text-secondary)",
            }}
          >
            {c.k} {pct(c.p)}
          </span>
        );
      })}
    </div>
  );
}

export default function FightProps({ f1, f2 }: FightPropsProps) {
  const [data, setData] = useState<FightPropsData | null>(null);
  const [failure, setFailure] = useState<PropsFailure | null>(null);
  const [fetched, setFetched] = useState(false);

  // Derived rather than stored, so nothing is set synchronously in the effect.
  const loading = !fetched;

  useEffect(() => {
    let alive = true;
    fetchFightProps(f1, f2).then((r) => {
      if (!alive) return;
      if (r.ok) setData(r.data);
      else setFailure(r.reason);
      setFetched(true);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2]);

  if (loading) {
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>
        Loading projections…
      </p>
    );
  }

  // 503 means the models aren't loaded server-side. Saying "no projections for
  // this fight" would be a lie about the matchup, so the section disappears.
  if (failure === "unavailable") return null;

  if (failure) {
    return (
      <p style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>
        {failure === "none"
          ? "No prop projections available for this matchup."
          : "Prop projections could not be loaded."}
      </p>
    );
  }

  if (!data) return null;

  const { duration, stats } = data;
  const n1 = lastNameOf(data.f1 || f1);
  const n2 = lastNameOf(data.f2 || f2);

  return (
    <div>
      <p style={{ ...label, marginBottom: 8 }}>Fight duration</p>
      <DurationBar name="Under 1.5 rounds" p={duration.p_under_1_5} />
      <DurationBar name="Over 1.5 rounds" p={complement(duration.p_under_1_5)} />
      <DurationBar name="Under 2.5 rounds" p={duration.p_under_2_5} />
      <DurationBar name="Goes to decision" p={duration.p_distance} />

      <p style={{ ...label, margin: "14px 0 8px" }}>
        Projected significant strikes landed
      </p>
      <StrikeRange name={n1} s={stats.f1.strikes} />
      <StrikeRange name={n2} s={stats.f2.strikes} />

      <p style={{ ...label, margin: "14px 0 8px" }}>Takedowns landed</p>
      <TakedownChips name={n1} t={stats.f1.takedowns} />
      <TakedownChips name={n2} t={stats.f2.takedowns} />

    </div>
  );
}

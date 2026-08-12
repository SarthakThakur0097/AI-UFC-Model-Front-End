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
import { MarketLine, MarketFootnote } from "./MarketLine";
import { hasMarketProps, type MarketProps, type MarketQuote } from "../lib/market";

/**
 * Props are shown as soon as a fight is expanded — there is no second toggle to
 * find. The fetch is still lazy: this component only mounts when the fight's
 * detail panel is open, so browsing the card costs nothing.
 */
/** Actual scraped stats for one fighter — past cards only. Null = scrape gap. */
export type ActualStats = {
  sigStrikes: number | null;
  takedowns: number | null;
};

type FightPropsProps = {
  f1: string;
  f2: string;
  /**
   * When set (past cards), the projections render with "actual" overlays:
   * a tick on each strike-range bar and a landed count beside the takedown
   * chips, so projection and reality sit in the same picture.
   */
  actuals?: { f1?: ActualStats | null; f2?: ActualStats | null } | null;
  /**
   * De-vigged market lines for the same duration markets, from /upcoming (or
   * /results for a settled card). Optional throughout: most fights have no
   * harvested line, and those must render without one rather than with a
   * placeholder.
   */
  marketProps?: MarketProps | null;
};

const label = { fontSize: 11, color: "var(--text-secondary)" } as const;

/**
 * Duration markets: one labelled bar each, with the market's own number
 * underneath when a line exists.
 *
 * `market` must be the quote for the SAME side the bar shows. The stored
 * quotes are all "under"/"yes" sides (u15, u25, dist), so the Over 1.5 bar
 * gets no quote rather than the under's — showing a market probability
 * against the complementary side would invert the edge, and it would look
 * completely reasonable while doing it.
 */
function DurationBar({
  name,
  p,
  market,
}: {
  name: string;
  p: number;
  market?: MarketQuote | null;
}) {
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
        style={{ height: 5, background: "var(--bg-inset)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, p * 100))}%`,
            background: "var(--matrix-green)",
          }}
        />
      </div>
      {market !== undefined && <MarketLine quote={market} modelP={p} />}
    </div>
  );
}

/**
 * Projected significant strikes as a q10–q90 range with the median marked.
 * A bar rather than a number because the spread is the point — a wide range is
 * the model saying it doesn't know.
 */
function StrikeRange({
  name,
  s,
  actual,
}: {
  name: string;
  s: FighterProps["strikes"];
  actual?: number | null;
}) {
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
          {actual != null && (
            <span style={{ color: "var(--matrix-green)" }}>
              {" "}
              · {actual} actual
            </span>
          )}
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
            background: "var(--bg-inset)",
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
            }}
          />
        ))}
        {/* what actually happened, on the same scale as the projection.
            positionWithin clamps, so an out-of-range actual pins to the edge */}
        {actual != null && (
          <div
            title={`actual ${actual}`}
            style={{
              position: "absolute",
              top: 1,
              left: `calc(${positionWithin(actual, s.q10, s.q90)}% - 1px)`,
              width: 2,
              height: 15,
              borderRadius: 1,
              background: "var(--text-primary)",
            }}
          />
        )}
      </div>
      <div className="flex justify-between" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        <span>{Math.round(s.q10)}</span>
        <span>{Math.round(s.q90)}</span>
      </div>
    </div>
  );
}

function TakedownChips({
  name,
  t,
  actual,
}: {
  name: string;
  t: FighterProps["takedowns"];
  actual?: number | null;
}) {
  const chips = [
    { k: "1+ TD", p: t.p_ge1 },
    { k: "2+", p: t.p_ge2 },
    { k: "3+", p: t.p_ge3 },
  ];
  return (
    <div className="flex items-center flex-wrap gap-2 mb-2">
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
              background: strong ? "var(--accent-soft-2)" : "transparent",
              border: `1px solid ${strong ? "var(--matrix-green)" : "var(--border)"}`,
              color: strong ? "var(--matrix-green)" : "var(--text-secondary)",
            }}
          >
            {c.k} {pct(c.p)}
          </span>
        );
      })}
      {actual != null && (
        <span
          className="text-xs font-medium"
          style={{ color: "var(--matrix-green)" }}
        >
          {actual} landed
        </span>
      )}
    </div>
  );
}

export default function FightProps({ f1, f2, actuals, marketProps }: FightPropsProps) {
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

  // Only pass a market slot to the bars whose side we actually hold a quote
  // for. `undefined` means "this bar has no market row at all"; `null` means
  // "there is a market row and we have no line" and renders a dash.
  const mkt = hasMarketProps(marketProps) ? marketProps! : null;

  return (
    <div>
      <p style={{ ...label, marginBottom: 8 }}>Fight duration</p>
      <DurationBar
        name="Under 1.5 rounds"
        p={duration.p_under_1_5}
        market={mkt ? mkt.u15 ?? null : undefined}
      />
      {/* No market slot: the stored quote is the UNDER side, and pairing it
          with the Over bar would flip the sign of the edge. */}
      <DurationBar name="Over 1.5 rounds" p={complement(duration.p_under_1_5)} />
      <DurationBar
        name="Under 2.5 rounds"
        p={duration.p_under_2_5}
        market={mkt ? mkt.u25 ?? null : undefined}
      />
      <DurationBar
        name="Goes to decision"
        p={duration.p_distance}
        market={mkt ? mkt.dist ?? null : undefined}
      />
      {mkt && <MarketFootnote />}

      <p style={{ ...label, margin: "14px 0 8px" }}>
        Projected significant strikes landed
      </p>
      <StrikeRange
        name={n1}
        s={stats.f1.strikes}
        actual={actuals?.f1?.sigStrikes}
      />
      <StrikeRange
        name={n2}
        s={stats.f2.strikes}
        actual={actuals?.f2?.sigStrikes}
      />

      <p style={{ ...label, margin: "14px 0 8px" }}>Takedowns landed</p>
      <TakedownChips
        name={n1}
        t={stats.f1.takedowns}
        actual={actuals?.f1?.takedowns}
      />
      <TakedownChips
        name={n2}
        t={stats.f2.takedowns}
        actual={actuals?.f2?.takedowns}
      />

    </div>
  );
}

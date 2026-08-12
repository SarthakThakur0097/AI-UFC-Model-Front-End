"use client";

import { useEffect, useState } from "react";
import { MarketLine, MarketFootnote } from "./MarketLine";
import type { MarketMethod, MarketMethodCorner } from "../lib/market";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type MethodResp = {
  f1_name: string;
  f2_name: string;
  f1: { KO: number; Sub: number; Dec: number };
  f2: { KO: number; Sub: number; Dec: number };
  f1_win: number;
  f2_win: number;
};

async function fetchMethod(
  f1: string,
  f2: string,
  asOfDate?: string
): Promise<MethodResp | null> {
  try {
    const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : "";
    const res = await fetch(
      `${API_URL}/predict/method_per_fighter?f1=${encodeURIComponent(
        f1
      )}&f2=${encodeURIComponent(f2)}${dateParam}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// `market` maps the model's KO/Sub/Dec onto the six BFO method props, which
// are keyed ko/sub/dec. Same three outcomes, different casing on each side of
// the wire — mapped explicitly rather than lowercased, so a future rename
// breaks the build instead of silently pairing the wrong market with a bar.
const ROWS: {
  key: "KO" | "Sub" | "Dec";
  market: "ko" | "sub" | "dec";
  label: string;
}[] = [
  { key: "KO", market: "ko", label: "KO/TKO" },
  { key: "Sub", market: "sub", label: "Submission" },
  { key: "Dec", market: "dec", label: "Decision" },
];

function FighterColumn({
  name,
  data,
  other,
  market,
}: {
  name: string;
  data: { KO: number; Sub: number; Dec: number };
  other: { KO: number; Sub: number; Dec: number };
  /** This corner's de-vigged method prices, or null when none were harvested. */
  market?: MarketMethodCorner | null;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 10,
        }}
      >
        {name}
      </p>
      {ROWS.map((row) => {
        const val = data[row.key];
        const isHigher = val >= other[row.key];
        return (
          <div key={row.key} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span
                style={{
                  color: isHigher
                    ? "var(--matrix-green)"
                    : "var(--text-secondary)",
                  fontWeight: isHigher ? 700 : 400,
                }}
              >
                {val}%
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: "var(--bg-inset)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${val}%`,
                  height: "100%",
                  background: isHigher
                    ? "var(--matrix-green)"
                    : "var(--matrix-green-dim)",
                  borderRadius: 3,
                }}
              />
            </div>
            {/* The model's numbers here are PERCENTAGES (0-100) while every
                market quote is a 0..1 probability, so scale before comparing —
                otherwise every edge is off by two orders of magnitude. */}
            {market !== undefined && (
              <MarketLine
                quote={market ? market[row.market] : null}
                modelP={val / 100}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Shared presentational view (used by both fetched and prop-fed data)
//
// NB on corner alignment: `market.f1` is the CARD's fighter_1, and so is
// `data.f1_name` — the backend re-orients the market block when BFO lists the
// corners the other way round (lookup_prop_lines / _orient_market_props). If
// that ever regressed, each fighter would be shown against the other's method
// prices, which looks entirely plausible on screen. Nothing here can detect
// it; the guarantee is upstream.
function MethodView({
  data,
  market,
}: {
  data: MethodResp;
  market?: MarketMethod | null;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <FighterColumn
          name={data.f1_name}
          data={data.f1}
          other={data.f2}
          market={market === undefined ? undefined : market?.f1 ?? null}
        />
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
        <FighterColumn
          name={data.f2_name}
          data={data.f2}
          other={data.f1}
          market={market === undefined ? undefined : market?.f2 ?? null}
        />
      </div>
      {market && <MarketFootnote />}
    </div>
  );
}

export default function MethodPerFighter({
  f1,
  f2,
  asOfDate,
  data: providedData,
  market,
}: {
  f1: string;
  f2: string;
  asOfDate?: string;
  // If provided (e.g. past cards reading from storage), render directly with
  // NO network call. If omitted (upcoming cards), fetch live.
  data?: MethodResp | null;
  /**
   * De-vigged method prices for this fight. Undefined hides the market rows
   * entirely; null shows them as dashes. Only the per-fighter legs are used —
   * `market.fight` has no price and is not rendered here.
   */
  market?: MarketMethod | null;
}) {
  const [data, setData] = useState<MethodResp | null>(providedData ?? null);
  const [loading, setLoading] = useState(!providedData);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // If data was provided as a prop, never fetch.
    if (providedData) {
      setData(providedData);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMethod(f1, f2, asOfDate).then((r) => {
      if (!alive) return;
      if (!r) setFailed(true);
      else setData(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2, asOfDate, providedData]);

  if (loading)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: "16px 0" }}>
        Loading method breakdown…
      </p>
    );

  if (failed || !data)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: "16px 0" }}>
        Method breakdown unavailable
      </p>
    );

  return <MethodView data={data} market={market} />;
}
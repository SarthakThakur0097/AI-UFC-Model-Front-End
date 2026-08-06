"use client";

import { useState } from "react";
import MethodPerFighter from "./MethodPerFighter";
import FightRadar from "./FightRadar";
import FighterRating from "./FighterRating";
import CommonOpponents from "./CommonOpponents";
import FightProps from "./FightProps";

type MethodPerFighterData = {
  f1_name: string;
  f2_name: string;
  f1: { KO: number; Sub: number; Dec: number };
  f2: { KO: number; Sub: number; Dec: number };
  f1_win: number;
  f2_win: number;
};

// Scraped per-fighter stats from the fight itself. Either side can be null
// (scrape gap) — render "—" for that side, don't hide the whole line.
type FighterActuals = {
  sig_strikes: number;
  takedowns: number;
  knockdowns: number;
} | null;

type FightActuals = {
  f1: FighterActuals;
  f2: FighterActuals;
  duration_min: number | null;
  ending_round: number | null;
  ending_time: string | null;
};

// How the pre-fight betting markets resolved. `result` is always present;
// the closing prices are often null (especially older fights) — render the
// settlement chip regardless and only add the price when present.
type PropSettled = {
  market: string;
  result: string; // "OVER" | "UNDER" for round totals, "YES" | "NO" for distance
  over_odds?: number | null;
  under_odds?: number | null;
  yes_odds?: number | null;
  no_odds?: number | null;
  // The model's honest pre-fight call, graded at settlement. All three are
  // null for fights predicted before prop-tracking shipped (2026-08-06) —
  // almost all current history. Null means "no call stored", never an error;
  // the graded record accumulates forward-only. Do not backfill.
  model_side?: string | null; // same vocabulary as `result`
  model_p?: number | null; // 0-1 confidence in its own side (>= 0.5)
  model_correct?: boolean | null;
};

type PastFight = {
  f1: string;
  f2: string;
  pick: string;
  conf: number;
  correct: boolean;
  result: string;
  f1_prob: number;
  f2_prob: number;
  actual_winner: string;
  method_pred: {
    Decision: number;
    "KO/TKO": number;
    Submission: number;
    pick: string;
  };
  method_per_fighter?: MethodPerFighterData | null;
  // null when stats weren't scraped for this fight
  actuals?: FightActuals | null;
  // null when the fight had no settleable result (DQ / NC / Overturned)
  props_settled?: PropSettled[] | null;
};

type PastCardProps = {
  event: string;
  date: string;
  fights: PastFight[];
};

// "84–46 sig str · 2–0 TD · 1–0 KD · ended R2 4:33" (f1 first, em-dash for a
// null side; KD segment only when someone actually scored one)
function buildStatLine(a: FightActuals): string {
  const v = (n: number | null | undefined) => (n == null ? "—" : String(n));
  const parts = [
    `${v(a.f1?.sig_strikes)}–${v(a.f2?.sig_strikes)} sig str`,
    `${v(a.f1?.takedowns)}–${v(a.f2?.takedowns)} TD`,
  ];
  if ((a.f1?.knockdowns ?? 0) > 0 || (a.f2?.knockdowns ?? 0) > 0) {
    parts.push(`${v(a.f1?.knockdowns)}–${v(a.f2?.knockdowns)} KD`);
  }
  if (a.ending_round != null && a.ending_time) {
    parts.push(`ended R${a.ending_round} ${a.ending_time}`);
  }
  return parts.join(" · ");
}

// American odds: +155 / -215 (trailing .0 dropped by number→string)
function formatOdds(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// Both sides of a settled market, winner flagged, each with its closing
// price when scraped. Distance markets settle YES/NO, round totals
// OVER/UNDER — the result's vocabulary tells us which pair to show.
function marketSides(
  p: PropSettled
): { label: string; odds: number | null; hit: boolean }[] {
  const distance = p.result === "YES" || p.result === "NO";
  const sides = distance
    ? [
        { key: "YES", label: "Yes", odds: p.yes_odds ?? null },
        { key: "NO", label: "No", odds: p.no_odds ?? null },
      ]
    : [
        { key: "OVER", label: "Over", odds: p.over_odds ?? null },
        { key: "UNDER", label: "Under", odds: p.under_odds ?? null },
      ];
  return sides.map((s) => ({
    label: s.label,
    odds: s.odds,
    hit: s.key === p.result,
  }));
}

// "OVER" -> "Over", "YES" -> "Yes" — for the model-call segment, which reads
// as prose ("model called Over") unlike the all-caps settlement result
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function PastCard({ event, date, fights }: PastCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const correct = fights.filter((f) => f.correct).length;
  const total = fights.length;

  // Model prop-call record across the card. Only markets with a stored
  // pre-fight call count; null-call markets (all pre-2026-08-06 history)
  // are neither graded nor shown.
  const gradedProps = fights
    .flatMap((f) => f.props_settled ?? [])
    .filter((p) => p.model_correct != null);
  const gradedCorrect = gradedProps.filter((p) => p.model_correct).length;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div>
          <p className="text-sm font-medium text-white">{event}</p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2.5 py-1 rounded-md font-medium"
            style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
          >
            {correct}/{total} correct
          </span>
          {gradedProps.length > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-md font-medium"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
            >
              Prop calls: {gradedCorrect}/{gradedProps.length}
            </span>
          )}
          <span
            className="text-xs px-2.5 py-1 rounded-md"
            style={{
              background: "var(--bg-detail)",
              color: "var(--text-secondary)",
            }}
          >
            Completed
          </span>
        </div>
      </div>

      {fights.map((fight, i) => (
        <div key={i}>
          {/* Fight Row */}
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              borderBottom:
                i < fights.length - 1 ? "1px solid var(--border)" : "none",
            }}
            className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${fight.correct ? "bg-green-500" : "bg-red-400"}`}
            ></div>
            <div className="flex-1">
              <p className="text-sm text-white">
                {fight.f1} vs {fight.f2}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Pick: {fight.pick} · {fight.conf}% confidence
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-xs font-medium ${fight.correct ? "text-green-400" : "text-red-400"}`}
              >
                {fight.correct ? "Correct" : "Incorrect"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {fight.result}
              </p>
            </div>
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {expanded === i ? "▲" : "▼"}
            </span>
          </div>

          {/* Detail Panel */}
          {expanded === i && (
            <div
              style={{
                background: "var(--bg-detail)",
                borderTop: "1px solid var(--border)",
              }}
              className="px-4 pb-4"
            >
              {/* Result banner (headline) + actual stats + prop settlement */}
              <div className="mt-4 mb-4">
                <div
                  className="px-3 py-2 rounded-lg text-xs font-medium"
                  style={{
                    background: fight.correct
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                    color: fight.correct ? "#4ade80" : "#f87171",
                  }}
                >
                  {fight.correct
                    ? `✓ Correct — ${fight.actual_winner} won by ${fight.result}`
                    : `✗ Incorrect — ${fight.actual_winner} won by ${fight.result}, model picked ${fight.pick}`}
                </div>

                {fight.actuals && (
                  <p
                    className="text-xs mt-2 px-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {buildStatLine(fight.actuals)}
                  </p>
                )}
              </div>

              {/* Fighter Rating. Like the radar below, this is the CURRENT
                  profile: /results carries no event_id, so there is no
                  fight-time snapshot to request. Labelled accordingly. */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Fighter Rating — current profile
              </p>
              <FighterRating f1={fight.f1} f2={fight.f2} />

              <div style={{ height: 20 }} />
              {/* Win Probability */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Win Probability
              </p>
              <div className="flex items-center gap-3 mb-1">
                <p className="text-sm font-medium text-white w-36 shrink-0">
                  {fight.f1}
                </p>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden flex"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${fight.f1_prob}%` }}
                  ></div>
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${fight.f2_prob}%` }}
                  ></div>
                </div>
                <p className="text-sm font-medium text-white w-36 shrink-0 text-right">
                  {fight.f2}
                </p>
              </div>
              <div className="flex justify-between mb-4">
                <p className="text-xs text-red-400 font-medium">
                  {fight.f1_prob}%
                </p>
                <p className="text-xs text-blue-400 font-medium">
                  {fight.f2_prob}%
                </p>
              </div>

              {/* Performance Radar — current profile (not fight-time) */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-1 mt-2 text-center"
                style={{ color: "var(--text-secondary)" }}
              >
                Performance Radar — current profile
              </p>
              <FightRadar f1={fight.f1} f2={fight.f2} />

              <div style={{ height: 20 }} />

              {/* Method Prediction — per-fighter, from stored data (no live fetch) */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Method of Victory
              </p>
              {fight.method_per_fighter ? (
                <MethodPerFighter
                  f1={fight.f1}
                  f2={fight.f2}
                  data={fight.method_per_fighter}
                />
              ) : (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)", padding: "8px 0" }}
                >
                  Method breakdown unavailable
                </p>
              )}

              {/* Common Opponents. Fetched live rather than from /results,
                  which doesn't carry it. Note this reflects TODAY's shared
                  history, so for an older card it can include bouts that
                  happened after the fight shown above. */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
                style={{ color: "var(--text-secondary)" }}
              >
                Common Opponents — to date
              </p>
              <CommonOpponents f1={fight.f1} f2={fight.f2} />

              {/* Props — same bottom placement as the upcoming card. The
                  projection bars (duration leans, projected sig strikes,
                  takedowns) are the model's CURRENT numbers for this pair,
                  like the rating/radar above — /results stores no fight-time
                  projection snapshot. Below them, how the real duration
                  markets settled. */}
              <div className="flex items-center gap-2 mt-5 mb-3">
                <p
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Props — current model projection
                </p>
                <span
                  className="text-xs px-1.5 rounded"
                  style={{
                    background: "rgba(255,59,92,0.12)",
                    color: "var(--matrix-red)",
                    letterSpacing: "1px",
                  }}
                >
                  EXPERIMENTAL
                </span>
              </div>
              <FightProps f1={fight.f1} f2={fight.f2} />

              {fight.props_settled && fight.props_settled.length > 0 && (
                <>
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    How the markets settled
                  </p>
                  <div>
                    {/* One row per market: label, then a chip per side — the
                        side that hit lights up green (same language as the
                        takedown chips above), the other stays muted. */}
                    {fight.props_settled.map((prop, j) => (
                      <div
                        key={j}
                        className="flex items-center flex-wrap gap-2 mb-2"
                      >
                        <span
                          className="text-xs truncate"
                          style={{ width: 130, color: "var(--text-secondary)" }}
                          title={prop.market}
                        >
                          {prop.market}
                        </span>
                        {marketSides(prop).map((side) => (
                          <span
                            key={side.label}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: side.hit
                                ? "rgba(0,255,102,0.12)"
                                : "transparent",
                              border: `1px solid ${side.hit ? "var(--matrix-green)" : "var(--border)"}`,
                              color: side.hit
                                ? "var(--matrix-green)"
                                : "var(--text-muted)",
                              fontWeight: side.hit ? 600 : 400,
                            }}
                          >
                            {side.hit ? "✓ " : ""}
                            {side.label}
                            {side.odds != null && ` ${formatOdds(side.odds)}`}
                          </span>
                        ))}
                        {prop.model_side != null && (
                          <span
                            className="text-xs font-medium"
                            style={{
                              color: prop.model_correct ? "#4ade80" : "#f87171",
                            }}
                          >
                            {prop.model_correct ? "✓" : "✗"} model called{" "}
                            {titleCase(prop.model_side)}
                            {prop.model_p != null &&
                              ` (${Math.round(prop.model_p * 100)}%)`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

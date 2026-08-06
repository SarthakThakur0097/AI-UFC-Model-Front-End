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

const mono = { fontFamily: "var(--font-mono)" } as const;

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

// "Bogdan Grad" -> "BG" for the avatar circles on the hero row
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function Avatar({ name, won }: { name: string; won: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 38,
        height: 38,
        background: "var(--bg-inset)",
        border: "1px solid var(--border)",
        color: won ? "var(--matrix-green)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 600,
        ...mono,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function PastCard({ event, date, fights }: PastCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showPropsHelp, setShowPropsHelp] = useState(false);
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
        backdropFilter: "blur(6px)",
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <p
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {event}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {date}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs px-2.5 py-1 rounded font-medium"
            style={{
              background: "var(--accent-soft-2)",
              color: "var(--matrix-green)",
              ...mono,
            }}
          >
            {correct}/{total} correct
          </span>
          {gradedProps.length > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded font-medium"
              style={{
                background: "var(--accent-soft-2)",
                color: "var(--matrix-green)",
                ...mono,
              }}
            >
              Prop calls: {gradedCorrect}/{gradedProps.length}
            </span>
          )}
          <span
            className="text-xs px-2.5 py-1 rounded"
            style={{
              background: "var(--accent-soft)",
              color: "var(--text-secondary)",
              letterSpacing: "1px",
              ...mono,
            }}
          >
            COMPLETED
          </span>
        </div>
      </div>

      {/* Fights: hero box for the main event, quiet one-line boxes after */}
      <div className="px-5 pb-5 flex flex-col gap-2.5">
        {fights.map((fight, i) => {
          const hero = i === 0;
          const isOpen = expanded === i;
          const f1Won = fight.actual_winner === fight.f1;
          const verdictColor = fight.correct
            ? "var(--matrix-green)"
            : "var(--matrix-red)";

          return (
            <div
              key={i}
              className="rounded-[10px] overflow-hidden"
              style={{
                border: `1px solid ${hero ? "var(--border-accent)" : "var(--border)"}`,
                background: hero ? "rgba(93, 202, 165, 0.03)" : "transparent",
              }}
            >
              {/* Row */}
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                className="cursor-pointer transition-colors hover:bg-[rgba(93,202,165,0.05)]"
                style={{ padding: hero ? "16px 18px" : "11px 15px" }}
              >
                {hero ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{
                          background: "var(--accent-soft-2)",
                          color: "var(--matrix-green)",
                          letterSpacing: "1px",
                          ...mono,
                        }}
                      >
                        MAIN EVENT
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: verdictColor }}
                      >
                        {fight.correct ? "✓ Correct" : "✗ Incorrect"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={fight.f1} won={f1Won} />
                        <span
                          className="text-[15px] font-semibold truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {fight.f1}
                        </span>
                      </div>
                      <span
                        className="text-xs shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        vs
                      </span>
                      <div className="flex items-center gap-2.5 min-w-0 justify-end">
                        <span
                          className="text-[15px] font-semibold truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {fight.f2}
                        </span>
                        <Avatar name={fight.f2} won={!f1Won} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {fight.actual_winner} won by {fight.result}
                      </span>
                      <span
                        className="text-xs shrink-0"
                        style={{ color: "var(--text-data)", ...mono }}
                      >
                        Pick: {fight.pick} · {fight.conf}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: verdictColor }}
                      />
                      <span
                        className="text-[13px] truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fight.f1}{" "}
                        <span style={{ color: "var(--text-muted)" }}>vs</span>{" "}
                        {fight.f2}
                      </span>
                    </div>
                    <span className="text-xs shrink-0" style={{ ...mono }}>
                      <span style={{ color: verdictColor }}>
                        {fight.correct ? "✓" : "✗"}
                      </span>{" "}
                      <span style={{ color: "var(--text-data)" }}>
                        {fight.result}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {isOpen && (
                <div
                  style={{
                    background: "var(--bg-detail)",
                    borderTop: "1px solid var(--border)",
                  }}
                  className="px-4 pb-4"
                >
                  {/* Result banner (headline). The actual stat line lives in
                      the Props section below, next to the projections it
                      should be compared against. */}
                  <div
                    className="mt-4 mb-4 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{
                      background: fight.correct
                        ? "var(--accent-soft)"
                        : "rgba(217, 120, 138, 0.10)",
                      color: verdictColor,
                    }}
                  >
                    {fight.correct
                      ? `✓ Correct — ${fight.actual_winner} won by ${fight.result}`
                      : `✗ Incorrect — ${fight.actual_winner} won by ${fight.result}, model picked ${fight.pick}`}
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
                  {/* Names above, bar full-width, percentages below — fixed
                      name columns overflowed narrow phones. */}
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p
                      className="text-sm font-medium truncate min-w-0"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fight.f1}
                    </p>
                    <p
                      className="text-sm font-medium truncate min-w-0 text-right"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fight.f2}
                    </p>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden flex"
                    style={{ background: "var(--bg-inset)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${fight.f1_prob}%`,
                        background: "var(--f1-color)",
                      }}
                    ></div>
                    <div
                      className="h-full"
                      style={{
                        width: `${fight.f2_prob}%`,
                        background: "var(--f2-color)",
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 mb-4">
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--f1-color)", ...mono }}
                    >
                      {fight.f1_prob}%
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--f2-color)", ...mono }}
                    >
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

                  {/* Method of Victory — per-fighter, from stored data (no live
                      fetch) */}
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
                      like the rating/radar above — /results stores no
                      fight-time projection snapshot. Below them, how the real
                      duration markets settled. */}
                  <div className="flex items-center flex-wrap gap-2 mt-5 mb-2">
                    <p
                      className="text-xs font-medium uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Props — current model projection
                    </p>
                    <span
                      className="text-xs px-1.5 rounded"
                      style={{
                        background: "var(--amber-soft)",
                        color: "var(--amber)",
                        letterSpacing: "1px",
                        ...mono,
                      }}
                    >
                      EXPERIMENTAL
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPropsHelp(!showPropsHelp);
                      }}
                      aria-label="How to read this section"
                      title="How to read this section"
                      className="flex items-center justify-center rounded-full cursor-pointer"
                      style={{
                        width: 16,
                        height: 16,
                        fontSize: 10,
                        fontStyle: "italic",
                        fontWeight: 700,
                        border: `1px solid ${showPropsHelp ? "var(--matrix-green)" : "var(--border)"}`,
                        color: showPropsHelp
                          ? "var(--matrix-green)"
                          : "var(--text-secondary)",
                        background: showPropsHelp
                          ? "var(--accent-soft)"
                          : "transparent",
                        ...mono,
                      }}
                    >
                      i
                    </button>
                  </div>

                  {/* Actual result, right next to the projections it should
                      be read against */}
                  {fight.actuals && (
                    <p
                      className="text-xs mb-3"
                      style={{ color: "var(--text-data)", ...mono }}
                    >
                      Actual: {buildStatLine(fight.actuals)}
                    </p>
                  )}

                  {showPropsHelp && (
                    <p
                      className="text-xs mb-3 px-3 py-2 rounded-lg"
                      style={{
                        color: "var(--text-secondary)",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        lineHeight: 1.6,
                      }}
                    >
                      The Actual line lists {fight.f1.split(" ").pop()} first,{" "}
                      {fight.f2.split(" ").pop()} second (— = not scraped).
                      Each bar below is the model&apos;s projected range: the
                      ends mark the 10th–90th percentile, the brighter band the
                      middle 50%, the green dot the median — and the thin white
                      tick shows what actually happened. Green counts are
                      actual results, and the settlement rows at the bottom
                      show which side of each betting market hit.
                    </p>
                  )}

                  <FightProps
                    f1={fight.f1}
                    f2={fight.f2}
                    actuals={
                      fight.actuals
                        ? {
                            f1: fight.actuals.f1
                              ? {
                                  sigStrikes: fight.actuals.f1.sig_strikes,
                                  takedowns: fight.actuals.f1.takedowns,
                                }
                              : null,
                            f2: fight.actuals.f2
                              ? {
                                  sigStrikes: fight.actuals.f2.sig_strikes,
                                  takedowns: fight.actuals.f2.takedowns,
                                }
                              : null,
                          }
                        : null
                    }
                  />

                  {fight.props_settled && fight.props_settled.length > 0 && (
                    <>
                      <p
                        className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        How the markets settled
                      </p>
                      <div>
                        {/* One row per market: label, then a chip per side —
                            the side that hit lights up (same language as the
                            takedown chips above), the other stays muted. */}
                        {fight.props_settled.map((prop, j) => (
                          <div
                            key={j}
                            className="flex items-center flex-wrap gap-2 mb-2"
                          >
                            <span
                              className="text-xs truncate"
                              style={{
                                width: 130,
                                color: "var(--text-secondary)",
                              }}
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
                                    ? "var(--accent-soft-2)"
                                    : "transparent",
                                  border: `1px solid ${side.hit ? "var(--matrix-green)" : "var(--border)"}`,
                                  color: side.hit
                                    ? "var(--matrix-green)"
                                    : "var(--text-muted)",
                                  fontWeight: side.hit ? 600 : 400,
                                  ...mono,
                                }}
                              >
                                {side.hit ? "✓ " : ""}
                                {side.label}
                                {side.odds != null &&
                                  ` ${formatOdds(side.odds)}`}
                              </span>
                            ))}
                            {prop.model_side != null && (
                              <span
                                className="text-xs font-medium"
                                style={{
                                  color: prop.model_correct
                                    ? "var(--matrix-green)"
                                    : "var(--matrix-red)",
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
          );
        })}
      </div>
    </div>
  );
}

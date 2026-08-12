"use client";

import React, { useState } from "react";
import FightRadar from "./FightRadar";
import MethodPerFighter from "./MethodPerFighter";
import CommonOpponents from "./CommonOpponents";
import FightProps from "./FightProps";
import {
  formatAmerican,
  formatCaptureTime,
  type MarketProps,
} from "../lib/market";
import FighterRating from "./FighterRating";
import EndOfCardEmailCapture from "./EndOfCardEmailCapture";
import { lastNameOf } from "../lib/props";

type Fight = {
  tag: string;
  tagColor: string;
  f1: string;
  f1Record: string;
  f2: string;
  f2Record: string;
  pick: string;
  conf: number;
  f1Prob: number;
  f2Prob: number;
  marketF1?: number | null;
  marketF2?: number | null;
  blendF1?: number | null;
  blendF2?: number | null;
  error?: boolean;
  method: {
    Decision: number;
    "KO/TKO": number;
    Submission: number;
  };
  commonOpponents?: { common: any[]; count: number } | null;
  methodPerFighter?: {
    f1_name: string;
    f2_name: string;
    f1: { KO: number; Sub: number; Dec: number };
    f2: { KO: number; Sub: number; Dec: number };
    f1_win: number;
    f2_win: number;
  } | null;
  /**
   * De-vigged prop lines for the markets the models price. Optional at every
   * level — most fights on a slate have no harvested line, and those render
   * without market rows rather than with placeholders.
   */
  marketProps?: MarketProps | null;
};

type FightCardProps = {
  event: string;
  date: string;
  fights: Fight[];
};

const mono = { fontFamily: "var(--font-mono)" } as const;

/**
 * DraftKings' own moneyline, when a manual capture exists.
 *
 * The only takeable price on the card: BestFightOdds carries neither DK nor
 * BetMGM, so `marketF1/marketF2` beside it are a de-vigged reference and not
 * something the reader can bet. Unlike a MarketQuote's `dk`, there is no
 * `best` to compare against — the moneyline arrives as its own columns, not as
 * a quote — so this is shown plainly with no better/worse highlight.
 *
 * Captured by hand, so it can be materially staler than everything else on the
 * row; `at` is the only thing that says how old it is, and it is always
 * rendered rather than tucked into a tooltip.
 */
function DkMoneyline({
  dkMl,
  f1,
  f2,
}: {
  dkMl: NonNullable<MarketProps["dk_ml"]>;
  f1: string;
  f2: string;
}) {
  const a = dkMl.f1?.american;
  const b = dkMl.f2?.american;
  if (a == null && b == null) return null;
  const at = formatCaptureTime(dkMl.f1?.at ?? dkMl.f2?.at);

  return (
    <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
      {"DraftKings: "}
      <span style={{ color: "var(--text-primary)", ...mono }}>
        {lastNameOf(f1)} {formatAmerican(a)} / {lastNameOf(f2)}{" "}
        {formatAmerican(b)}
      </span>
      {at && (
        <span style={{ opacity: 0.75 }}>
          {"  ·  captured "}
          {at}
        </span>
      )}
    </p>
  );
}

// "Islam Makhachev" -> "IM" for the avatar circles on the hero row
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function Avatar({ name, lead }: { name: string; lead: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 38,
        height: 38,
        background: "var(--bg-inset)",
        border: "1px solid var(--border)",
        color: lead ? "var(--matrix-green)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 600,
        ...mono,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function FightCard({ event, date, fights }: FightCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggle = (i: number) => setExpanded(expanded === i ? null : i);

  // Card-wide probability mode. "blend" (default) leads with the model+market
  // blend where a line exists; "model" shows raw model output everywhere.
  // Fights with no scraped line are model-only in both modes.
  const [probMode, setProbMode] = useState<"blend" | "model">("blend");
  const cardHasBlend = fights.some(
    (f) => typeof f.blendF1 === "number" && typeof f.blendF2 === "number"
  );

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
        <div className="flex items-center gap-2">
          {/* Blend/model view switch — only when some fight has a market line */}
          {cardHasBlend && (
            <div className="flex" role="group" aria-label="Probability mode">
              {(["blend", "model"] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => setProbMode(m)}
                  title={
                    m === "blend"
                      ? "Model + market blend (default) — measured more accurate than either alone."
                      : "Raw model output, ignoring the betting market."
                  }
                  className="text-[10px] px-2 py-1 cursor-pointer uppercase"
                  style={{
                    letterSpacing: "0.5px",
                    border: "1px solid var(--border)",
                    borderLeft: i === 0 ? "1px solid var(--border)" : "none",
                    borderRadius: i === 0 ? "5px 0 0 5px" : "0 5px 5px 0",
                    background:
                      probMode === m ? "var(--accent-soft-2)" : "transparent",
                    color:
                      probMode === m
                        ? "var(--matrix-green)"
                        : "var(--text-secondary)",
                    ...mono,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <span
            className="text-xs px-2.5 py-1 rounded"
            style={{
              background: "var(--accent-soft-2)",
              color: "var(--matrix-green)",
              letterSpacing: "1px",
              ...mono,
            }}
          >
            UPCOMING
          </span>
        </div>
      </div>

      {/* Fights: hero box for the main event, quiet one-line boxes after */}
      <div className="px-5 pb-4 flex flex-col gap-2.5">
        {fights.map((fight, i) => {
          const hero = i === 0;
          const hasPrediction = !fight.error && !!fight.pick;
          const isOpen = expanded === i;
          // market_*/blend_* are null whenever no line was scraped — the common
          // case — so everything below degrades to model-only silently.
          const hasBlend =
            typeof fight.blendF1 === "number" && typeof fight.blendF2 === "number";
          const useBlend = probMode === "blend" && hasBlend;
          const leadF1 = useBlend ? (fight.blendF1 as number) : fight.f1Prob;
          const leadF2 = useBlend ? (fight.blendF2 as number) : fight.f2Prob;
          const disagrees =
            typeof fight.marketF1 === "number" &&
            Math.abs(fight.f1Prob - fight.marketF1) >= 15;
          const f1Leads = leadF1 >= leadF2;
          const leaderPct = Math.round(f1Leads ? leadF1 : leadF2);
          const leaderLabel = `${lastNameOf(f1Leads ? fight.f1 : fight.f2)} ${leaderPct}%`;

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
                onClick={() => toggle(i)}
                className="cursor-pointer transition-colors hover:bg-[rgba(93,202,165,0.05)]"
                style={{ padding: hero ? "16px 18px" : "11px 15px" }}
              >
                {hero ? (
                  <>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{
                        background: "var(--accent-soft-2)",
                        color: "var(--matrix-green)",
                        letterSpacing: "1px",
                        ...mono,
                      }}
                    >
                      {fight.tag === "Main" ? "MAIN EVENT" : fight.tag.toUpperCase()}
                    </span>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={fight.f1} lead={hasPrediction && f1Leads} />
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
                        <Avatar name={fight.f2} lead={hasPrediction && !f1Leads} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 mt-3">
                      {hasPrediction ? (
                        <>
                          <div
                            className="flex-1 rounded-full overflow-hidden"
                            style={{ height: 5, background: "var(--bg-inset)" }}
                          >
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, f1Leads ? leadF1 : leadF2))}%`,
                                background: "var(--matrix-green)",
                              }}
                            />
                          </div>
                          <span
                            className="text-[13px] font-semibold shrink-0"
                            style={{ color: "var(--matrix-green)", ...mono }}
                          >
                            {leaderLabel}
                          </span>
                          {useBlend && (
                            <span
                              className="text-[9px] px-1 py-0.5 rounded shrink-0"
                              style={{
                                background: "var(--accent-soft)",
                                color: "var(--text-data)",
                                letterSpacing: "0.5px",
                                ...mono,
                              }}
                              title="Model + market blend — raw model and market numbers are in the expanded panel."
                            >
                              BLEND
                            </span>
                          )}
                        </>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)", ...mono }}
                        >
                          N/A — no model pick
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: "var(--accent-soft)",
                          color: "var(--text-secondary)",
                          letterSpacing: "1px",
                          ...mono,
                        }}
                      >
                        {fight.tag.toUpperCase()}
                      </span>
                      <span
                        className="text-[13px] truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fight.f1}{" "}
                        <span style={{ color: "var(--text-muted)" }}>vs</span>{" "}
                        {fight.f2}
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-xs"
                        style={{
                          color: hasPrediction
                            ? "var(--text-data)"
                            : "var(--text-muted)",
                          ...mono,
                        }}
                      >
                        {hasPrediction ? leaderLabel : "N/A"}
                      </span>
                      {hasPrediction && useBlend && (
                        <span
                          className="text-[9px] px-1 py-0.5 rounded"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--text-data)",
                            letterSpacing: "0.5px",
                            ...mono,
                          }}
                          title="Model + market blend — raw model and market numbers are in the expanded panel."
                        >
                          BLEND
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Detail Panel. Opens even without a win prediction: rating,
                  radar, method, common opponents and props are all fetched
                  independently of it, and a fight can have props while the
                  winner model skipped it. Only the win-probability bar is
                  gated. */}
              {isOpen && (
                <div
                  style={{
                    background: "var(--bg-detail)",
                    borderTop: "1px solid var(--border)",
                  }}
                  className="px-4 pb-6 pt-4"
                >
                  {/* Fighter Rating */}
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Fighter Rating
                  </p>
                  <FighterRating f1={fight.f1} f2={fight.f2} />

                  <div style={{ height: 20 }} />
                  {/* Win Probability. Suppressed without a prediction — f1Prob/
                      f2Prob are substituted with a placeholder 50/50 upstream,
                      so rendering the bar here would show a confident-looking
                      coin-flip the model never produced. */}
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Win Probability
                  </p>
                  {hasPrediction ? (
                    <>
                      {/* Lead with the learned blend when a market line exists —
                          it is measured more accurate than either input. Falls
                          back to model-only when market_* is null, which is the
                          majority of fights. */}
                      <div
                        className="flex rounded-md overflow-hidden mb-2"
                        style={{ height: 30, border: "1px solid var(--border)" }}
                      >
                        <div
                          className="flex items-center px-2 text-xs font-bold"
                          style={{
                            width: `${leadF1}%`,
                            background: "rgba(93, 202, 165, 0.32)",
                            color: "#dff3ea",
                            ...mono,
                          }}
                        >
                          {Math.round(leadF1)}%
                        </div>
                        <div
                          className="flex items-center justify-end px-2 text-xs font-bold ml-auto"
                          style={{
                            width: `${leadF2}%`,
                            background: "rgba(217, 120, 138, 0.32)",
                            color: "#f6e3e7",
                            ...mono,
                          }}
                        >
                          {Math.round(leadF2)}%
                        </div>
                      </div>
                      {hasBlend ? (
                        <div className="mb-5">
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {useBlend
                              ? "Showing the model blended with the betting market — switch to MODEL for the raw model output."
                              : "Showing raw model output — switch to BLEND to mix in the betting market, which has measured more accurate than either alone."}
                            {typeof fight.marketF1 === "number" && (
                              <>
                                {"  ·  Market: "}
                                <span style={{ color: "var(--text-primary)" }}>
                                  {Math.round(fight.marketF1)}% /{" "}
                                  {Math.round(fight.marketF2 ?? 100 - fight.marketF1)}%
                                </span>
                              </>
                            )}
                          </p>
                          {fight.marketProps?.dk_ml && (
                            <DkMoneyline
                              dkMl={fight.marketProps.dk_ml}
                              f1={fight.f1}
                              f2={fight.f2}
                            />
                          )}
                          {disagrees && (
                            <span
                              className="inline-block text-xs px-1.5 py-0.5 rounded mt-1.5"
                              style={{
                                background: "var(--amber-soft)",
                                color: "var(--amber)",
                                border: "1px solid var(--border)",
                              }}
                              title="The model and the betting market differ by 15 points or more on this fight."
                            >
                              model and market disagree
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mb-5" />
                      )}
                    </>
                  ) : (
                    <div className="mb-5">
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
                      >
                        No win prediction for this fight — the model skips
                        fighters with too little UFC history. Everything below is
                        computed independently and is still shown.
                      </p>
                      {/* The model failing to price a fight says nothing about
                          whether a line exists, and these are exactly the
                          debut/thin-history bouts where the market is the only
                          signal there is — so it is shown here even though the
                          row upstairs reads N/A. No blend and no edge: both
                          need a model number, and this fight has none. The
                          50/50 stand-in page.tsx substitutes is never drawn. */}
                      {typeof fight.marketF1 === "number" && (
                        <p
                          className="text-xs mt-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {"Betting market: "}
                          <span style={{ color: "var(--text-primary)", ...mono }}>
                            {Math.round(fight.marketF1)}% /{" "}
                            {Math.round(fight.marketF2 ?? 100 - fight.marketF1)}%
                          </span>
                        </p>
                      )}
                      {fight.marketProps?.dk_ml && (
                        <DkMoneyline
                          dkMl={fight.marketProps.dk_ml}
                          f1={fight.f1}
                          f2={fight.f2}
                        />
                      )}
                    </div>
                  )}

                  {/* Radar */}
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-1 text-center"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Performance Radar — percentile vs division
                  </p>
                  <FightRadar f1={fight.f1} f2={fight.f2} />

                  {/* Method of Victory — per fighter */}
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Method of Victory
                  </p>
                  <MethodPerFighter
                    f1={fight.f1}
                    f2={fight.f2}
                    data={fight.methodPerFighter ?? undefined}
                    market={fight.marketProps?.method ?? null}
                  />
                  {/* Common Opponents */}
                  <p
                    className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Common Opponents
                  </p>
                  <CommonOpponents
                    f1={fight.f1}
                    f2={fight.f2}
                    data={fight.commonOpponents ?? undefined}
                  />

                  {/* Props. Still fetched lazily — the component only mounts
                      when this panel is open — but with no second click to find
                      it. */}
                  <div className="flex items-center gap-2 mt-5 mb-3">
                    <p
                      className="text-xs font-medium uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Props
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
                  </div>
                  <FightProps
                    f1={fight.f1}
                    f2={fight.f2}
                    marketProps={fight.marketProps ?? null}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* End-of-card email capture */}
      <EndOfCardEmailCapture source={`card_${event}`} />
    </div>
  );
}

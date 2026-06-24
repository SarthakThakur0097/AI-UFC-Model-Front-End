"use client";

import React, { useState } from "react";
import FightRadar from "./FightRadar";
import MethodPerFighter from "./MethodPerFighter";
import CommonOpponents from "./CommonOpponents";
import FighterRating from "./FighterRating";

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
  error?: boolean;
  method: {
    Decision: number;
    "KO/TKO": number;
    Submission: number;
  };
};

type FightCardProps = {
  event: string;
  date: string;
  fights: Fight[];
};

export default function FightCard({ event, date, fights }: FightCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggle = (i: number) => setExpanded(expanded === i ? null : i);

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
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div>
          <p
            className="text-sm font-bold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {event}
          </p>
          <p
            className="text-xs mt-0.5 uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {date}
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-md font-medium uppercase tracking-wider"
          style={{
            background: "rgba(0,255,102,0.10)",
            color: "var(--matrix-green)",
            border: "1px solid var(--border)",
          }}
        >
          Upcoming
        </span>
      </div>

      {/* Fights */}
      {fights.map((fight, i) => {
        const hasPrediction = !fight.error && !!fight.pick;
        const isOpen = expanded === i;

        return (
          <div key={i}>
            {/* Fight Row */}
            <div
              onClick={() => toggle(i)}
              style={{
                borderBottom:
                  i < fights.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
              className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-[rgba(0,255,102,0.04)] transition-colors"
            >
              {/* Tag */}
              <span
                className="text-xs font-medium shrink-0 text-center"
                style={{
                  width: 70,
                  color: "var(--matrix-green)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "3px 0",
                  letterSpacing: "1px",
                }}
              >
                {fight.tag}
              </span>

              {/* Fighters */}
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span
                  className="text-sm font-bold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fight.f1}
                </span>
                <span
                  className="text-xs shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  vs
                </span>
                <span
                  className="text-sm font-bold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fight.f2}
                </span>
              </div>

              {/* Prediction */}
              <div
                className="shrink-0 flex flex-col items-end gap-1"
                style={{ width: 96 }}
              >
                {!hasPrediction ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    N/A
                  </p>
                ) : (
                  <>
                    <p
                      className="text-xs font-bold truncate max-w-full"
                      style={{ color: "var(--matrix-green)" }}
                    >
                      {fight.pick?.split(" ").pop() ?? "—"}
                    </p>
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 4, background: "rgba(0,255,102,0.12)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${fight.conf}%`,
                          background: "var(--matrix-green)",
                          boxShadow: "0 0 8px var(--matrix-green)",
                        }}
                      />
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fight.conf}%
                    </p>
                  </>
                )}
              </div>

              {/* Chevron */}
              <span
                className="text-xs shrink-0 transition-transform"
                style={{
                  color: "var(--matrix-green-dim)",
                  transform: isOpen ? "rotate(180deg)" : "none",
                }}
              >
                ▼
              </span>
            </div>

            {/* Detail Panel */}
            {isOpen && hasPrediction && (
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
                {/* Win Probability */}
                <p
                  className="text-xs font-medium uppercase tracking-widest mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Win Probability
                </p>
                <div
                  className="flex rounded-md overflow-hidden mb-5"
                  style={{ height: 30, border: "1px solid var(--border)" }}
                >
                  <div
                    className="flex items-center px-2 text-xs font-bold"
                    style={{
                      width: `${fight.f1Prob}%`,
                      background: "rgba(255,59,92,0.4)",
                      color: "#ffd9e0",
                    }}
                  >
                    {fight.f1Prob}%
                  </div>
                  <div
                    className="flex items-center justify-end px-2 text-xs font-bold ml-auto"
                    style={{
                      width: `${fight.f2Prob}%`,
                      background: "rgba(57,192,255,0.4)",
                      color: "#d9f3ff",
                    }}
                  >
                    {fight.f2Prob}%
                  </div>
                </div>

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
                <MethodPerFighter f1={fight.f1} f2={fight.f2} />
                {/* Common Opponents */}
<p
  className="text-xs font-medium uppercase tracking-widest mb-3 mt-5"
  style={{ color: "var(--text-secondary)" }}
>
  Common Opponents
</p>
<CommonOpponents f1={fight.f1} f2={fight.f2} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
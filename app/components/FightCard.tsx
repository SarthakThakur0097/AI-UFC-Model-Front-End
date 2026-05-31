"use client";

import { useState } from "react";

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

export default function FightCard({ fights }: { fights: Fight[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (i: number) => {
    setExpanded(expanded === i ? null : i);
  };

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
          <p className="text-sm font-medium text-white">
            UFC Fight Night — Newark
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            May 31, 2026 · Prudential Center
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-md font-medium"
          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
        >
          Upcoming
        </span>
      </div>

      {/* Fights */}
      {fights.map((fight, i) => (
        <div key={i}>
          {/* Fight Row */}
          <div
            onClick={() => toggle(i)}
            style={{
              borderBottom:
                i < fights.length - 1 ? "1px solid var(--border)" : "none",
            }}
            className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-white/5"
          >
            {/* Tag */}
            <span
              className={`text-xs font-medium w-10 sm:w-14 shrink-0 ${fight.tagColor}`}
            >
              {fight.tag}
            </span>

            {/* F1 */}
            <div className="w-24 sm:w-36 shrink-0">
              <p className="text-sm font-medium text-white truncate">
                {fight.f1}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {fight.f1Record}
              </p>
            </div>

            {/* VS */}
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              vs
            </span>

            {/* F2 */}
            <div className="w-24 sm:w-36 shrink-0">
              <p className="text-sm font-medium text-white truncate">
                {fight.f2}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {fight.f2Record}
              </p>
            </div>

            <div className="flex-1" />

            {/* Prediction */}
            <div className="w-14 sm:w-20 shrink-0 flex flex-col items-end gap-1">
              {fight.error ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  N/A
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-white truncate max-w-full">
                    {fight.pick.split(" ").pop()}
                  </p>
                  <div
                    className="w-full h-1 rounded-full overflow-hidden"
                    style={{ background: "var(--border)" }}
                  >
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${fight.conf}%` }}
                    ></div>
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
              className="text-xs shrink-0 hidden sm:block"
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
              {/* Win Probability */}
              <p
                className="text-xs font-medium uppercase tracking-widest mt-4 mb-3"
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
                    style={{ width: `${fight.f1Prob}%` }}
                  ></div>
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${fight.f2Prob}%` }}
                  ></div>
                </div>
                <p className="text-sm font-medium text-white w-36 shrink-0 text-right">
                  {fight.f2}
                </p>
              </div>
              <div className="flex justify-between mb-4">
                <p className="text-xs text-red-400 font-medium">
                  {fight.f1Prob}%
                </p>
                <p className="text-xs text-blue-400 font-medium">
                  {fight.f2Prob}%
                </p>
              </div>

              {/* Method of Victory */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Method of Victory
              </p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(fight.method).map(([method, pct]) => (
                  <div
                    key={method}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                    className="rounded-lg p-3"
                  >
                    <p
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {method}
                    </p>
                    <p className="text-lg font-medium text-white">{pct}%</p>
                    <div
                      className="h-1 rounded-full mt-2 overflow-hidden"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className={`h-full rounded-full ${method === "Decision" ? "bg-blue-400" : method === "KO/TKO" ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <p
                className="text-xs mt-3"
                style={{ color: "var(--text-muted)" }}
              >
                Model accuracy: 66.8% on 2023–2024 fights
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";

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
};

type PastCardProps = {
  event: string;
  date: string;
  fights: PastFight[];
};

export default function PastCard({ event, date, fights }: PastCardProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const correct = fights.filter((f) => f.correct).length;
  const total = fights.length;

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
              {/* Result banner */}
              <div
                className="mt-4 mb-4 px-3 py-2 rounded-lg text-xs font-medium"
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

              {/* Method Prediction */}
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Method Prediction
              </p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(fight.method_pred)
                  .filter(([key]) => key !== "pick")
                  .map(([method, pct]) => (
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

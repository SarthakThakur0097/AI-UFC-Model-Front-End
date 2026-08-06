"use client";

import OddsMarketSection from "./OddsMarketSection";
import {
  MARKETS,
  countEnteredValues,
  countMarketValues,
  type FightOddsInput,
  type MarketId,
} from "../lib/odds";
import type { PromptFightModel } from "../lib/oddsPrompt";

type OddsFightRowProps = {
  fight: PromptFightModel;
  odds: FightOddsInput;
  openMarkets: MarketId[];
  expanded: boolean;
  isLast: boolean;
  onToggleExpand: () => void;
  onChangeField: (market: MarketId, key: string, value: string) => void;
  onClearMarket: (market: MarketId) => void;
  onToggleMarket: (market: MarketId) => void;
};

export default function OddsFightRow({
  fight,
  odds,
  openMarkets,
  expanded,
  isLast,
  onToggleExpand,
  onChangeField,
  onClearMarket,
  onToggleMarket,
}: OddsFightRowProps) {
  const total = countEnteredValues(odds);

  // Enter on a market's last input opens the next market.
  const advanceFrom = (marketId: MarketId) => {
    const i = MARKETS.findIndex((m) => m.id === marketId);
    const next = MARKETS[i + 1];
    if (next && !openMarkets.includes(next.id)) onToggleMarket(next.id);
  };

  return (
    <div>
      {/* Collapsed row — same chrome as FightCard so it reads as one product */}
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        style={{
          borderBottom: !isLast || expanded ? "1px solid var(--border)" : "none",
        }}
        className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-[rgba(93,202,165,0.05)] transition-colors"
      >
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-sm font-bold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {fight.f1}
            </span>
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              vs
            </span>
            <span
              className="text-sm font-bold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {fight.f2}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {fight.hasPrediction && fight.pick
              ? `Model: ${fight.pick} ${fight.conf ?? 0}%`
              : "No model prediction"}
          </p>
        </div>

        <div className="shrink-0 text-right" style={{ width: 72 }}>
          {total > 0 ? (
            <span className="text-xs font-bold" style={{ color: "var(--matrix-green)" }}>
              {total} odds
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              —
            </span>
          )}
        </div>

        <span
          className="text-xs shrink-0 transition-transform"
          style={{
            color: "var(--matrix-green-dim)",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded: model context + market sections */}
      {expanded && (
        <div
          style={{
            background: "var(--bg-detail)",
            borderBottom: isLast ? "none" : "1px solid var(--border)",
          }}
          className="px-4 pb-2 pt-3"
        >
          {fight.hasPrediction ? (
            <div className="mb-2">
              {typeof fight.f1Prob === "number" && typeof fight.f2Prob === "number" && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Win probability:{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {fight.f1Prob.toFixed(0)}% / {fight.f2Prob.toFixed(0)}%
                  </span>
                </p>
              )}
              {fight.method && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Model method:{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    KO {fight.method["KO/TKO"]}% · Sub {fight.method.Submission}% · Dec{" "}
                    {fight.method.Decision}%
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs mb-2" style={{ color: "var(--matrix-red)" }}>
              No model prediction for this fight — odds entered here go to Claude as
              market context only.
            </p>
          )}

          {MARKETS.map((spec) => (
            <OddsMarketSection
              key={spec.id}
              spec={spec}
              f1={fight.f1}
              f2={fight.f2}
              values={(odds[spec.id] as Record<string, string> | undefined) ?? {}}
              open={openMarkets.includes(spec.id)}
              filled={countMarketValues(odds, spec.id)}
              onToggle={() => onToggleMarket(spec.id)}
              onChange={(key, value) => onChangeField(spec.id, key, value)}
              onClear={() => onClearMarket(spec.id)}
              onAdvance={() => advanceFrom(spec.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

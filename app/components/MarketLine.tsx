"use client";

import {
  DASH,
  edgePp,
  edgeTone,
  formatAmerican,
  formatEdge,
  moveFromOpen,
  type MarketQuote,
} from "../lib/market";

/**
 * The market's view of one market, rendered under the model's own bar.
 *
 * DESIGN RULE, and it is a research constraint rather than a taste one: the
 * edge is shown for DURATION and METHOD markets only, never the moneyline.
 * RESEARCH.md §1 measures the winner model at or slightly below the closing
 * line, so a green "+8" beside a moneyline would advertise an edge the
 * project's own evidence says is not there. §10 treats duration and method as
 * the genuinely open frontier, which is why they get one.
 *
 * Absent data renders as an em dash. Never substitute a default — an edge
 * computed against a price that was never quoted is worse than no number.
 */

const tone = {
  none: "var(--text-secondary)",
  slight: "var(--matrix-green-dim)",
  strong: "var(--matrix-green)",
} as const;

export function MarketLine({
  quote,
  modelP,
  showEdge = true,
}: {
  quote: MarketQuote | null | undefined;
  /** Model probability for the SAME side, 0..1. Omit to show market only. */
  modelP?: number | null;
  showEdge?: boolean;
}) {
  if (!quote) {
    return (
      <div style={row}>
        <span style={muted}>market {DASH}</span>
      </div>
    );
  }

  const pp = showEdge ? edgePp(modelP, quote.p) : null;
  const t = edgeTone(pp);
  const move = moveFromOpen(quote);

  return (
    <div style={row}>
      <span style={muted}>
        market <span style={{ color: "var(--text-primary)" }}>
          {Math.round(quote.p * 100)}%
        </span>
      </span>

      <span style={sep}>·</span>

      <span style={muted} title={
        quote.best_book
          ? `Best of the ${quote.books} book(s) BestFightOdds quotes. DraftKings and BetMGM post no prices there and Fanatics is not carried, so this is a market reference, not necessarily a price you can take.`
          : undefined
      }>
        {formatAmerican(quote.best)}
        {quote.best_book ? (
          <span style={{ opacity: 0.75 }}> {quote.best_book}</span>
        ) : null}
      </span>

      {move !== null && Math.abs(move) >= 0.5 && (
        <>
          <span style={sep}>·</span>
          {/* Movement since the opening consensus. Direction only — an arrow
              reads faster than a signed number and this is context, not a
              call. */}
          <span style={muted} title="Move in de-vigged probability since the opening line">
            {move > 0 ? "▲" : "▼"}
            {Math.abs(Math.round(move * 10) / 10).toFixed(1)}
          </span>
        </>
      )}

      {pp !== null && (
        <>
          <span style={{ ...sep, marginLeft: "auto" }} />
          <span
            style={{
              color: tone[t],
              fontWeight: t === "strong" ? 700 : 500,
              fontVariantNumeric: "tabular-nums",
            }}
            title="Model probability minus the de-vigged market probability, in percentage points."
          >
            {formatEdge(pp)}
          </span>
        </>
      )}
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  marginTop: 2,
  marginBottom: 6,
  lineHeight: 1.4,
  flexWrap: "wrap",
};

const muted: React.CSSProperties = { color: "var(--text-secondary)" };
const sep: React.CSSProperties = { color: "var(--border)" };

/**
 * One-line note explaining what the market numbers are and are not. Rendered
 * once per section rather than per row, because the caveat is real but
 * repeating it eleven times a card would make it invisible.
 */
export function MarketFootnote() {
  return (
    <p
      style={{
        fontSize: 9.5,
        color: "var(--text-muted)",
        marginTop: 6,
        lineHeight: 1.5,
      }}
    >
      Market figures are de-vigged consensus across the sportsbooks
      BestFightOdds lists; prices shown are that board&rsquo;s best. DraftKings
      and BetMGM post no prices there and Fanatics is not covered, so treat them
      as a reference rather than a quote.
    </p>
  );
}

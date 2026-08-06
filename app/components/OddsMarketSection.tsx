"use client";

import { useRef } from "react";
import OddsInput from "./OddsInput";
import { lastName, type AnyMarketSpec, type MarketField } from "../lib/odds";

type OddsMarketSectionProps = {
  spec: AnyMarketSpec;
  f1: string;
  f2: string;
  /** Raw entered strings for this market only. */
  values: Record<string, string>;
  open: boolean;
  filled: number;
  onToggle: () => void;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  /** Enter on the last input advances to the next market. */
  onAdvance: () => void;
};

const headerCell = {
  fontSize: 11,
  color: "var(--text-secondary)",
} as const;

export default function OddsMarketSection({
  spec,
  f1,
  f2,
  values,
  open,
  filled,
  onToggle,
  onChange,
  onClear,
  onAdvance,
}: OddsMarketSectionProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Enter moves to the next input, Shift+Enter to the previous, and Enter on
   * the last field opens the next market. Inputs are queried from the DOM in
   * document order, which is why nothing sets tabIndex — reading order and tab
   * order are already the same.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();

    const inputs = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>("input[data-odds-input]") ?? []
    );
    const i = inputs.indexOf(e.currentTarget);
    if (i === -1) return;

    const next = e.shiftKey ? i - 1 : i + 1;
    if (next < 0) return;
    if (next >= inputs.length) {
      e.currentTarget.blur();
      onAdvance();
      return;
    }
    inputs[next].focus();
    inputs[next].select();
  };

  const renderField = (field: MarketField, hideLabel = false) => (
    <OddsInput
      key={field.key as string}
      label={field.label(f1, f2)}
      value={values[field.key as string] ?? ""}
      kind={field.kind}
      placeholder={field.placeholder}
      hideLabel={hideLabel}
      onChange={(v) => onChange(field.key as string, v)}
      onKeyDown={handleKeyDown}
    />
  );

  const renderBody = () => {
    const fields = spec.fields as readonly MarketField[];

    // Two fighter columns, half the fields each (method, methodDouble, exactMethod).
    if (spec.layout === "grid3x2" || spec.layout === "grid5x2") {
      const half = fields.length / 2;
      const cols: { name: string; items: MarketField[] }[] = [
        { name: lastName(f1), items: fields.slice(0, half) },
        { name: lastName(f2), items: fields.slice(half) },
      ];
      return (
        <div className="flex gap-4">
          {cols.map((col) => (
            <div key={col.name} style={{ flex: 1, minWidth: 0 }}>
              <p
                className="text-xs font-bold mb-2 truncate"
                style={{ color: "var(--text-primary)" }}
                title={col.name}
              >
                {col.name}
              </p>
              {col.items.map((field) => (
                <div key={field.key as string} className="flex items-center gap-2 mb-2">
                  <span className="flex-1 truncate" style={headerCell}>
                    {field.rowLabel ? field.rowLabel() : field.label(f1, f2)}
                  </span>
                  {renderField(field, true)}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    // One row per selection, labeled the way the book words it. Deliberately
    // not a matrix: making the user map a book line onto a grid cell is how a
    // price ends up on the wrong outcome, which nothing downstream can catch.
    if (spec.layout === "list") {
      return (
        <div>
          {fields.map((field) => (
            <div key={field.key as string} className="flex items-center gap-3 mb-2">
              <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {field.label(f1, f2)}
              </span>
              <div className="shrink-0">{renderField(field, true)}</div>
            </div>
          ))}
        </div>
      );
    }

    // A posted line on its own row, then the two prices (totalRounds, handicap).
    if (spec.layout === "line2") {
      const line = fields.find((f) => f.kind === "line");
      const prices = fields.filter((f) => f.kind === "odds");
      return (
        <div>
          {line && <div className="mb-3">{renderField(line)}</div>}
          <div className="flex gap-3">{prices.map((f) => renderField(f))}</div>
        </div>
      );
    }

    // pair
    return <div className="flex gap-3">{fields.map((f) => renderField(f))}</div>;
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <div
        onClick={onToggle}
        className="px-1 py-2 flex items-center gap-2 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span
          className="text-xs uppercase tracking-widest font-medium truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {spec.title}
        </span>
        {filled > 0 && (
          <span
            className="text-xs px-1.5 rounded"
            style={{
              background: "rgba(93,202,165,0.10)",
              color: "var(--matrix-green)",
            }}
          >
            {filled}
          </span>
        )}
        <span className="flex-1" />
        {filled > 0 && (
          <span
            role="button"
            tabIndex={0}
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }
            }}
          >
            clear
          </span>
        )}
        <span
          className="text-xs transition-transform"
          style={{
            color: "var(--matrix-green-dim)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </span>
      </div>

      {open && (
        <div ref={bodyRef} className="pb-4 pt-1">
          {spec.hint && (
            <p className="mb-3" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {spec.hint}
            </p>
          )}
          {renderBody()}
        </div>
      )}
    </div>
  );
}

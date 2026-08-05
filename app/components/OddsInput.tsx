"use client";

import { useState } from "react";
import {
  formatAmericanOdds,
  parseAmericanOdds,
  parseLine,
  type FieldKind,
} from "../lib/odds";

type OddsInputProps = {
  label: string;
  value: string;
  kind: FieldKind;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Hide the label when a grid column header already names the field. */
  hideLabel?: boolean;
  width?: number;
};

/**
 * One odds/line input. Styling is lifted from EndOfCardEmailCapture so the two
 * forms in this app look like the same product.
 *
 * Validation runs on BLUR, never per keystroke — validating while typing means
 * "-1" flashes red on the way to "-155". On a valid blur the display is
 * normalized ("150" becomes "+150") so the column reads consistently.
 */
export default function OddsInput({
  label,
  value,
  kind,
  placeholder,
  onChange,
  onKeyDown,
  hideLabel,
  width = 76,
}: OddsInputProps) {
  const [touched, setTouched] = useState(false);

  const parse = kind === "line" ? parseLine : parseAmericanOdds;
  const filled = value.trim() !== "";
  const invalid = touched && filled && parse(value) === null;

  const handleBlur = () => {
    setTouched(true);
    if (!filled) return;
    // Normalize the display of a valid entry; leave invalid text alone so the
    // user can see and fix exactly what they typed.
    const n = parse(value);
    if (n === null) return;
    const normalized = kind === "line" ? String(n) : formatAmericanOdds(n);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div style={{ minWidth: 0 }}>
      {!hideLabel && (
        <p
          className="text-xs mb-1 truncate"
          style={{ color: "var(--text-secondary)" }}
          title={label}
        >
          {label}
        </p>
      )}
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        data-odds-input=""
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          if (touched) setTouched(false);
          onChange(e.target.value);
        }}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        style={{
          background: "var(--bg-card)",
          border: `1px solid ${invalid ? "var(--matrix-red)" : "var(--border)"}`,
          color: invalid ? "var(--matrix-red)" : "var(--text-primary)",
          width,
        }}
        className="text-xs px-2 py-1.5 rounded outline-none"
      />
      {invalid && (
        <p className="mt-1" style={{ fontSize: 10, color: "var(--matrix-red)" }}>
          {kind === "line" ? "e.g. 2.5" : "e.g. -155"}
        </p>
      )}
    </div>
  );
}

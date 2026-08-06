"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type MethodResp = {
  f1_name: string;
  f2_name: string;
  f1: { KO: number; Sub: number; Dec: number };
  f2: { KO: number; Sub: number; Dec: number };
  f1_win: number;
  f2_win: number;
};

async function fetchMethod(
  f1: string,
  f2: string,
  asOfDate?: string
): Promise<MethodResp | null> {
  try {
    const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : "";
    const res = await fetch(
      `${API_URL}/predict/method_per_fighter?f1=${encodeURIComponent(
        f1
      )}&f2=${encodeURIComponent(f2)}${dateParam}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const ROWS: { key: "KO" | "Sub" | "Dec"; label: string }[] = [
  { key: "KO", label: "KO/TKO" },
  { key: "Sub", label: "Submission" },
  { key: "Dec", label: "Decision" },
];

function FighterColumn({
  name,
  data,
  other,
}: {
  name: string;
  data: { KO: number; Sub: number; Dec: number };
  other: { KO: number; Sub: number; Dec: number };
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 10,
        }}
      >
        {name}
      </p>
      {ROWS.map((row) => {
        const val = data[row.key];
        const isHigher = val >= other[row.key];
        return (
          <div key={row.key} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span
                style={{
                  color: isHigher
                    ? "var(--matrix-green)"
                    : "var(--text-secondary)",
                  fontWeight: isHigher ? 700 : 400,
                }}
              >
                {val}%
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: "var(--bg-inset)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${val}%`,
                  height: "100%",
                  background: isHigher
                    ? "var(--matrix-green)"
                    : "var(--matrix-green-dim)",
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Shared presentational view (used by both fetched and prop-fed data)
function MethodView({ data }: { data: MethodResp }) {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <FighterColumn name={data.f1_name} data={data.f1} other={data.f2} />
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
      <FighterColumn name={data.f2_name} data={data.f2} other={data.f1} />
    </div>
  );
}

export default function MethodPerFighter({
  f1,
  f2,
  asOfDate,
  data: providedData,
}: {
  f1: string;
  f2: string;
  asOfDate?: string;
  // If provided (e.g. past cards reading from storage), render directly with
  // NO network call. If omitted (upcoming cards), fetch live.
  data?: MethodResp | null;
}) {
  const [data, setData] = useState<MethodResp | null>(providedData ?? null);
  const [loading, setLoading] = useState(!providedData);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // If data was provided as a prop, never fetch.
    if (providedData) {
      setData(providedData);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMethod(f1, f2, asOfDate).then((r) => {
      if (!alive) return;
      if (!r) setFailed(true);
      else setData(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2, asOfDate, providedData]);

  if (loading)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: "16px 0" }}>
        Loading method breakdown…
      </p>
    );

  if (failed || !data)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: "16px 0" }}>
        Method breakdown unavailable
      </p>
    );

  return <MethodView data={data} />;
}
"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

type FightResult = {
  result: "win" | "loss" | string;
  method: string;
  round: number | null;
  date: string;
};

type CommonEntry = { opponent: string; f1: FightResult; f2: FightResult };

type CommonResp = {
  f1_name?: string;
  f2_name?: string;
  count: number;
  common: CommonEntry[];
};

async function fetchCommon(f1: string, f2: string): Promise<CommonResp | null> {
  try {
    const res = await fetch(
      `${API_URL}/fight/common_opponents?f1=${encodeURIComponent(
        f1
      )}&f2=${encodeURIComponent(f2)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function yr(date: string): string {
  return date ? date.slice(0, 4) : "";
}

function ResultLine({ name, r }: { name: string; r: FightResult }) {
  const win = r.result === "win";
  const color = win ? "var(--matrix-green)" : "var(--matrix-red)";
  const methodStr = r.method + (r.round ? ` R${r.round}` : "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "2px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ width: 70, color: "var(--text-primary)", flexShrink: 0 }}>{name}</span>
      <span style={{ color, fontWeight: 700, width: 38, flexShrink: 0 }}>
        {win ? "WIN" : "LOSS"}
      </span>
      <span style={{ color: "var(--text-secondary)", flex: 1 }}>{methodStr}</span>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{yr(r.date)}</span>
    </div>
  );
}

export default function CommonOpponents({
  f1,
  f2,
  data: provided,
}: {
  f1: string;
  f2: string;
  // optional cached payload ({ common, count }) from /upcoming. If given, we
  // render it directly with NO live fetch. If omitted, we fetch live (fallback).
  data?: CommonResp | null;
}) {
  const [data, setData] = useState<CommonResp | null>(provided ?? null);
  const [loading, setLoading] = useState(provided === undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // cached data supplied (including explicit null = "computed, none found") → no fetch
    if (provided !== undefined) {
      setData(provided);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchCommon(f1, f2).then((r) => {
      if (!alive) return;
      if (!r) setFailed(true);
      else setData(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [f1, f2, provided]);

  if (loading)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", padding: "12px 0" }}>
        Loading common opponents…
      </p>
    );

  if (failed)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", padding: "12px 0" }}>
        Common opponents unavailable
      </p>
    );

  if (!data || data.count === 0 || !data.common?.length)
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>
        No common opponents
      </p>
    );

  // last names: prefer the response's names (live fetch), else derive from props
  // (cached payload doesn't carry the full names).
  const f1Last = (data.f1_name ?? f1).split(" ").pop() ?? f1;
  const f2Last = (data.f2_name ?? f2).split(" ").pop() ?? f2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.common.map((c, i) => (
        <div key={i}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            {c.opponent}
          </p>
          <ResultLine name={f1Last} r={c.f1} />
          <ResultLine name={f2Last} r={c.f2} />
        </div>
      ))}
    </div>
  );
}
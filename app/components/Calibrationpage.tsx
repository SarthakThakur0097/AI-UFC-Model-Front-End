"use client";

// Model calibration breakdown. Two views of the SAME underlying data:
//   1. Predicted-vs-actual bars per confidence band (more legible to a
//      first-time visitor who doesn't know what "calibration" means)
//   2. A calibration scatter — predicted vs actual, bubble size = sample
//      size, diagonal = perfect calibration (the more rigorous framing)
//
// Honesty-first design constraint baked into the data itself (not just this
// component): every bucket carries a `low_sample` flag computed server-side
// (n < 25). Low-sample buckets render in a muted/dashed style so they can't
// be mistaken for buckets with real statistical weight — same discipline as
// FightRadar.tsx's "Limited adjusted data" state for sparse adjperf data.
//
// This page makes a CALIBRATION claim only. It does not claim or imply any
// betting edge against the market — no edge against the closing line has
// been demonstrated, and this page stays scoped to what the data shows.

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  BarController,
  BarElement,
  BubbleController,
  PointElement,
  CategoryScale,
  LinearScale,
  LineElement,
  LineController,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import type { Calibration, CalibrationBucket } from "../lib/api";

Chart.register(
  BarController,
  BarElement,
  BubbleController,
  PointElement,
  CategoryScale,
  LinearScale,
  LineElement,
  LineController,
  Tooltip,
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

const MONO = "'Courier New', monospace";
const GREEN = "#00ff66";
const GREEN_DIM = "rgba(0,255,102,0.25)";
const BLUE = "#39c0ff";
const BLUE_DIM = "rgba(57,192,255,0.25)";
const AMBER = "#ff9a4d";
const AMBER_DIM = "rgba(255,154,77,0.18)";
const MUTED_TEXT = "#5f8f73";
const GRID = "rgba(0,255,102,0.08)";

async function fetchCalibration(): Promise<Calibration | null> {
  try {
    const res = await fetch(`${API_URL}/calibration`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function BarView({ buckets }: { buckets: CalibrationBucket[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const real = buckets.filter((b) => b.n > 0);

    const predictedColors = real.map((b) => (b.low_sample ? BLUE_DIM : BLUE));
    const actualColors = real.map((b) => (b.low_sample ? GREEN_DIM : GREEN));
    const predictedBorders = real.map((b) => (b.low_sample ? BLUE : "transparent"));
    const actualBorders = real.map((b) => (b.low_sample ? GREEN : "transparent"));

    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels: real.map((b) => `${b.bucket}\nn=${b.n}`),
        datasets: [
          {
            label: "Predicted",
            data: real.map((b) => b.avg_predicted ?? 0),
            backgroundColor: predictedColors,
            borderColor: predictedBorders,
            borderWidth: 1.5,
            borderRadius: 2,
          },
          {
            label: "Actual",
            data: real.map((b) => b.accuracy_pct ?? 0),
            backgroundColor: actualColors,
            borderColor: actualBorders,
            borderWidth: 1.5,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,14,6,0.95)",
            borderColor: "rgba(0,255,102,0.3)",
            borderWidth: 1,
            titleFont: { family: MONO, size: 13 },
            bodyFont: { family: MONO, size: 13 },
            callbacks: {
              label: (ctx) => {
                const b = real[ctx.dataIndex];
                const suffix = b.low_sample ? "  (low sample)" : "";
                return `${ctx.dataset.label}: ${ctx.parsed.y}%${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: MUTED_TEXT, font: { family: MONO, size: 12 } },
            grid: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: MUTED_TEXT,
              font: { family: MONO, size: 12 },
              callback: (v) => v + "%",
            },
            grid: { color: GRID },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [buckets]);

  return (
    <div style={{ position: "relative", width: "100%", height: 300 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Bar chart comparing the model's predicted probability to actual win rate across confidence bands. Bands with fewer than 25 fights are shown muted with dashed borders."
      />
    </div>
  );
}

function ScatterView({ buckets }: { buckets: CalibrationBucket[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const real = buckets.filter((b) => b.n > 0);
    const maxN = Math.max(...real.map((b) => b.n));
    const radius = (n: number) => 4 + Math.sqrt(n / maxN) * 16;

    const reliable = real.filter((b) => !b.low_sample);
    const lowSample = real.filter((b) => b.low_sample);

    const config: ChartConfiguration<"bubble" | "line"> = {
      type: "bubble",
      data: {
        datasets: [
          {
            type: "line",
            label: "Perfect calibration",
            data: [
              { x: 48, y: 48 },
              { x: 102, y: 102 },
            ] as any,
            borderColor: "#3a5c47",
            borderDash: [5, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            order: 0,
          },
          {
            type: "bubble",
            label: "Reliable bands",
            data: reliable.map((b) => ({
              x: b.avg_predicted,
              y: b.accuracy_pct,
              r: radius(b.n),
            })) as any,
            backgroundColor: GREEN_DIM,
            borderColor: GREEN,
            borderWidth: 1.5,
            order: 1,
          },
          {
            type: "bubble",
            label: "Low sample bands",
            data: lowSample.map((b) => ({
              x: b.avg_predicted,
              y: b.accuracy_pct,
              r: radius(b.n),
            })) as any,
            backgroundColor: AMBER_DIM,
            borderColor: AMBER,
            borderWidth: 1.5,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 16 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,14,6,0.95)",
            borderColor: "rgba(0,255,102,0.3)",
            borderWidth: 1,
            titleFont: { family: MONO, size: 13 },
            bodyFont: { family: MONO, size: 13 },
            callbacks: {
              label: (ctx) => {
                const all = [...reliable, ...lowSample];
                const match = all.find(
                  (b) =>
                    Math.abs((b.avg_predicted ?? 0) - (ctx.raw as any).x) < 0.05 &&
                    Math.abs((b.accuracy_pct ?? 0) - (ctx.raw as any).y) < 0.05,
                );
                const n = match ? match.n : "?";
                const flag = match?.low_sample ? " (low sample)" : "";
                return `predicted ${(ctx.raw as any).x}%, actual ${(ctx.raw as any).y}% (n=${n})${flag}`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 45,
            max: 105,
            title: { display: true, text: "predicted %", color: "#3a5c47", font: { family: MONO, size: 12 } },
            ticks: { color: MUTED_TEXT, font: { family: MONO, size: 12 } },
            grid: { color: GRID },
          },
          y: {
            min: 45,
            max: 105,
            title: { display: true, text: "actual %", color: "#3a5c47", font: { family: MONO, size: 12 } },
            ticks: { color: MUTED_TEXT, font: { family: MONO, size: 12 } },
            grid: { color: GRID },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [buckets]);

  return (
    <div style={{ position: "relative", width: "100%", height: 360, maxWidth: 420, margin: "0 auto" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Scatter plot of predicted probability versus actual win rate per confidence band, bubble size proportional to sample size. Points near the diagonal line indicate good calibration. Bands with fewer than 25 fights are shown muted with dashed borders to indicate low statistical confidence."
      />
    </div>
  );
}

export default function CalibrationPage() {
  const [data, setData] = useState<Calibration | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"bars" | "scatter">("bars");

  useEffect(() => {
    let alive = true;
    fetchCalibration().then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: MUTED_TEXT, padding: "40px 0" }}>
        Loading calibration data…
      </p>
    );
  }

  if (!data) {
    return (
      <p style={{ textAlign: "center", fontSize: 12, color: MUTED_TEXT, padding: "40px 0" }}>
        Calibration data unavailable right now.
      </p>
    );
  }

  const lowSampleCount = data.buckets.filter((b) => b.low_sample && b.n > 0).length;

  return (
    <div>
      {/* headline numbers */}
      <div
        className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-xs font-medium text-white">
            {data.total_fights.toLocaleString()} graded fights
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Predicted probability vs. actual outcome, by confidence band
          </p>
        </div>
        <span className="text-lg font-semibold" style={{ color: "#4ade80" }}>
          {data.overall_accuracy}%
        </span>
      </div>

      {/* toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        {(["bars", "scatter"] as const).map((v, i) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              fontSize: 12,
              letterSpacing: "0.5px",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: MONO,
              textTransform: "uppercase",
              border: "1px solid var(--border)",
              borderLeft: i === 0 ? "1px solid var(--border)" : "none",
              borderRadius: i === 0 ? "5px 0 0 5px" : "0 5px 5px 0",
              background: view === v ? "rgba(0,255,102,0.15)" : "transparent",
              color: view === v ? "var(--matrix-green)" : "var(--text-secondary)",
            }}
          >
            {v === "bars" ? "Predicted vs actual" : "Calibration curve"}
          </button>
        ))}
      </div>

      {view === "bars" ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 10, fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 10, height: 10, background: BLUE, display: "inline-block" }} />
              Predicted
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 10, height: 10, background: GREEN, display: "inline-block" }} />
              Actual
            </span>
          </div>
          <BarView buckets={data.buckets} />
        </>
      ) : (
        <ScatterView buckets={data.buckets} />
      )}

      <p style={{ textAlign: "center", fontSize: 12, color: "#5f8f73", marginTop: 14, lineHeight: 1.7 }}>
        Bands shown in orange/dashed have fewer than 25 graded fights — too
        few to draw conclusions from.
        {lowSampleCount > 0 &&
          ` ${lowSampleCount} band${lowSampleCount > 1 ? "s" : ""} currently fall${
            lowSampleCount > 1 ? "" : "s"
          } into this category.`}
        <br />
        This measures how honest the model is about its own confidence — not
        whether it beats the betting market. No edge against the closing line
        has been demonstrated.
      </p>
    </div>
  );
}
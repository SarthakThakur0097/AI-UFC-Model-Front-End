"use client";

import { useEffect, useRef } from "react";

// Falling background of MMA data rather than katakana glyphs. The katakana
// version read as a direct lift of a very recognizable film effect; fight
// metrics keep the falling-column idea while making the content our own —
// and they're on-topic for the product.

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: readonly T[]): T => a[rnd(a.length)];

const METHODS = ["SUB", "KO", "TKO", "DEC", "UD", "SD", "MD", "RNC"] as const;
const STAT_KEYS = ["SIG", "STR", "CTRL", "ACC", "DEF"] as const;

// Two-letter fighter initials. Generated rather than listed so the rain never
// reads as a fixed roster that has to be kept current.
const LETTERS = "ABCDEFGHIJKLMNOPRSTVWZ";

/**
 * One cell of falling text. Every call returns a fresh value, so a column shows
 * varied readings as it descends instead of repeating one token.
 */
function token(): string {
  switch (rnd(10)) {
    case 0:
      return `KO ${20 + rnd(60)}%`;
    case 1:
      return `TD ${(0.4 + Math.random() * 5).toFixed(1)}`;
    case 2: {
      const price = 105 + rnd(400);
      return Math.random() < 0.5 ? `+${price}` : `-${price}`;
    }
    case 3:
      return `${pick(STAT_KEYS)} ${28 + rnd(55)}%`;
    case 4:
      return pick(METHODS);
    case 5:
      return `${pick(LETTERS.split(""))}${pick(LETTERS.split(""))}`;
    case 6:
      return Math.random().toFixed(2);
    case 7:
      return `R${1 + rnd(5)}`;
    case 8:
      return `${(1 + Math.random() * 4).toFixed(1)} SLPM`;
    default:
      return `${40 + rnd(56)}%`;
  }
}

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 12;
    // Wide enough for the longest token ("4.2 SLPM") plus breathing room —
    // single glyphs tiled at font width would overlap once cells hold words.
    const colWidth = 74;
    const rowHeight = 20;

    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.max(1, Math.floor(canvas.width / colWidth));
      // Stagger the start so columns don't descend as one solid rank.
      drops = Array.from({ length: cols }, () =>
        Math.floor((Math.random() * -canvas.height) / rowHeight)
      );
    };
    resize();
    window.addEventListener("resize", resize);

    let frame: number;
    let last = 0;
    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      if (t - last < 70) return; // throttle; the trail does the rest
      last = t;

      // trail fade accumulates to the page background (--bg-primary #080b09)
      ctx.fillStyle = "rgba(8,11,9,0.09)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * rowHeight;
        if (y > 0) {
          // Occasional brighter cell gives the columns some depth instead of
          // a flat wall of one green. Sage palette — literals, since canvas
          // can't resolve CSS vars (keep in sync with globals.css).
          ctx.fillStyle = Math.random() < 0.12 ? "#d9f3ea" : "#5dcaa5";
          ctx.fillText(token(), i * colWidth + 6, y);
        }
        if (y > canvas.height && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        opacity: 0.1,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}

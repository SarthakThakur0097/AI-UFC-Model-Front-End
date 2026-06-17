"use client";

import { useEffect, useRef } from "react";

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 14;
    const chars = "ｱｲｳｴｵｶｷｸ01アカサ010110MMA01".split("");
    let cols = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / fontSize);
      drops = Array(cols).fill(1);
    };
    resize();
    window.addEventListener("resize", resize);

    let frame: number;
    let last = 0;
    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      if (t - last < 55) return; // throttle ~18fps
      last = t;

      ctx.fillStyle = "rgba(0,6,0,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff66";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const c = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(c, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
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
        opacity: 0.3,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
"use client";

import { useState } from "react";

type EndOfCardEmailCaptureProps = {
  /** Identifies which card this capture lives on, e.g. `card_UFC 326` */
  source: string;
};

export default function EndOfCardEmailCapture({ source }: EndOfCardEmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/email-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error("signup failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (status === "done") {
    return (
      <div
        style={{
          background: "var(--bg-detail)",
          border: "1px solid var(--border-accent)",
        }}
        className="mx-4 mb-4 rounded-lg px-5 py-4 text-center"
      >
        <p className="text-sm font-medium" style={{ color: "var(--matrix-green)" }}>
          You&apos;re on the list — breakdown lands before fight night.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-detail)",
        border: "1px solid var(--matrix-green)",
      }}
      className="mx-4 mb-4 rounded-lg px-5 py-4 text-center"
    >
      <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        Want the full breakdown for this card?
      </p>
      <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
        Written analysis and the betting angle for every fight, sent before fight night.
      </p>

      <div className="flex gap-2 justify-center flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          onKeyDown={handleKeyDown}
          placeholder="you@email.com"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            width: 200,
          }}
          className="text-xs px-3 py-2 rounded outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={status === "loading"}
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--border-accent)",
            color: "var(--matrix-green)",
          }}
          className="text-xs px-4 py-2 rounded whitespace-nowrap disabled:opacity-50"
        >
          {status === "loading" ? "Sending..." : "Get breakdown"}
        </button>
      </div>

      {status === "error" && (
        <p className="text-xs mt-2" style={{ color: "var(--matrix-red)" }}>
          Enter a valid email.
        </p>
      )}
    </div>
  );
}

// Skeleton mirrors the redesigned card anatomy: header, a taller hero box,
// then quiet one-line rows. Shimmer blocks use the inset well color.
export default function LoadingSkeleton() {
  const block = { background: "var(--bg-inset)" } as const;

  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-baseline justify-between">
        <div>
          <div className="h-4 w-48 rounded mb-2" style={block}></div>
          <div className="h-3 w-32 rounded" style={block}></div>
        </div>
        <div className="h-6 w-20 rounded" style={block}></div>
      </div>

      <div className="px-5 pb-5 flex flex-col gap-2.5">
        {/* Hero box */}
        <div
          className="rounded-[10px] p-4"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="h-4 w-24 rounded mb-4" style={block}></div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-[38px] h-[38px] rounded-full" style={block}></div>
              <div className="h-4 w-32 rounded" style={block}></div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-32 rounded" style={block}></div>
              <div className="w-[38px] h-[38px] rounded-full" style={block}></div>
            </div>
          </div>
          <div className="h-[5px] rounded-full" style={block}></div>
        </div>

        {/* Quiet rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-[10px] px-4 py-3 flex items-center justify-between gap-3"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-12 rounded" style={block}></div>
              <div className="h-4 w-52 rounded" style={block}></div>
            </div>
            <div className="h-3 w-20 rounded" style={block}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

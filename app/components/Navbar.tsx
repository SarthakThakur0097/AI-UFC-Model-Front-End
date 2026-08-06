const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past cards" },
  { id: "calibration", label: "Calibration" },
  { id: "methodology", label: "Methodology" },
];

export default function Navbar({
  activeTab = "upcoming",
}: {
  activeTab?: string;
}) {
  return (
    <nav
      style={{
        background: "rgba(10, 13, 10, 0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border)",
      }}
      className="px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3 sticky top-0 z-50"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: "var(--matrix-green)" }}
        />
        <span
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Mma<span style={{ color: "var(--matrix-green)" }}>Matrix</span>
        </span>
      </div>

      {/* Tabs — plain text with a sage underline on the active one, sitting on
          the nav's bottom border. Scrolls horizontally instead of wrapping when
          the viewport is too narrow to fit all four. */}
      <div className="no-scrollbar flex items-center gap-0.5 h-full overflow-x-auto min-w-0">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <a
              key={tab.id}
              href={`/?tab=${tab.id}`}
              className="relative h-full flex items-center px-3 sm:px-4 text-[13px] whitespace-nowrap transition-colors"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {tab.label}
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3 sm:left-4 sm:right-4 rounded-full"
                  style={{ height: 2, background: "var(--matrix-green)" }}
                />
              )}
            </a>
          );
        })}
      </div>

      {/* AI picks status — hidden on phones, where the tabs need the room */}
      <div
        className="hidden md:flex items-center gap-[7px] px-3 py-1.5 rounded-full shrink-0"
        style={{ border: "1px solid var(--bg-inset)" }}
      >
        <span
          className="relative inline-block w-[6px] h-[6px] rounded-full"
          style={{ background: "var(--matrix-green)" }}
        >
          <span
            className="absolute rounded-full"
            style={{
              inset: -3,
              border: "1px solid rgba(93, 202, 165, 0.4)",
            }}
          />
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-data)" }}
        >
          AI picks live
        </span>
      </div>
    </nav>
  );
}

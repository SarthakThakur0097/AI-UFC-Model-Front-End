export default function Navbar({
  activeTab = "upcoming",
}: {
  activeTab?: string;
}) {
  const tabBase =
    "px-4 py-1.5 text-sm rounded-md font-medium transition-colors";

  return (
    <nav
      style={{
        background: "rgba(20,20,20,0.8)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid #222",
      }}
      className="px-6 h-[60px] flex items-center justify-between sticky top-0 z-50"
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="w-[7px] h-[7px] rounded-full bg-red-500"
          style={{ boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}
        />
        <span className="text-[15px] font-semibold text-white tracking-tight">
          Mma<span className="text-red-500">Matrix</span>
        </span>
      </div>

      {/* Segmented tabs */}
      <div
        className="flex gap-0.5 p-[3px] rounded-[10px]"
        style={{ background: "#141414", border: "1px solid #242424" }}
      >
        <a
          href="/?tab=upcoming"
          className={tabBase}
          style={
            activeTab === "upcoming"
              ? { background: "#262626", color: "#fff" }
              : { color: "#777" }
          }
        >
          Upcoming
        </a>
        <a
          href="/?tab=past"
          className={tabBase}
          style={
            activeTab === "past"
              ? { background: "#262626", color: "#fff" }
              : { color: "#777" }
          }
        >
          Past cards
        </a>
        <a
          href="/?tab=calibration"
          className={tabBase}
          style={
            activeTab === "calibration"
              ? { background: "#262626", color: "#fff" }
              : { color: "#777" }
          }
        >
          Calibration
        </a>
        <a
          href="/?tab=methodology"
          className={tabBase}
          style={
            activeTab === "methodology"
              ? { background: "#262626", color: "#fff" }
              : { color: "#777" }
          }
        >
          Methodology
        </a>
      </div>

      {/* AI picks status */}
      <div
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
        style={{
          color: "#aaa",
          border: "1px solid #2a2a2a",
          background: "#161616",
        }}
      >
        <span className="inline-block w-[5px] h-[5px] rounded-full bg-green-400" />
        AI picks
      </div>
    </nav>
  );
}
export default function Navbar({
  activeTab = "upcoming",
}: {
  activeTab?: string;
}) {
  return (
    <nav
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
      }}
      className="px-6 h-14 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <span className="text-sm font-medium text-white">FightAI</span>
      </div>
      <div className="flex gap-1">
        <a
          href="/?tab=upcoming"
          className={`px-3 py-1.5 text-sm rounded-md font-medium ${activeTab === "upcoming" ? "text-white" : "text-gray-500"}`}
          style={
            activeTab === "upcoming"
              ? { background: "rgba(255,255,255,0.1)" }
              : {}
          }
        >
          Upcoming
        </a>
        <a
          href="/?tab=past"
          className={`px-3 py-1.5 text-sm rounded-md font-medium ${activeTab === "past" ? "text-white" : "text-gray-500"}`}
          style={
            activeTab === "past" ? { background: "rgba(255,255,255,0.1)" } : {}
          }
        >
          Past cards
        </a>
      </div>
      <div
        className="text-xs px-2 py-1 rounded-md text-gray-500 border"
        style={{ borderColor: "var(--border)" }}
      >
        AI picks
      </div>
    </nav>
  );
}

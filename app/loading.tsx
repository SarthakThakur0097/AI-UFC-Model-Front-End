import Navbar from "./components/Navbar";
import LoadingSkeleton from "./components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <p
          className="text-xs font-medium uppercase tracking-widest mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Loading fights…
        </p>
        <LoadingSkeleton />
      </div>
    </main>
  );
}

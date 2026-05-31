import Navbar from "./components/Navbar";
import LoadingSkeleton from "./components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <p className="text-xs font-medium text-red-500 uppercase tracking-widest mb-1">
          Next Event
        </p>
        <h1 className="text-xl font-medium text-gray-900 mb-1">
          UFC 328 — May 9, 2026
        </h1>
        <p className="text-sm text-gray-400 mb-4">
          6 fights · AI predictions for all bouts
        </p>
        <LoadingSkeleton />
      </div>
    </main>
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="h-4 w-36 bg-gray-100 rounded mb-1"></div>
          <div className="h-3 w-48 bg-gray-100 rounded"></div>
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-md"></div>
      </div>

      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className={`px-4 py-3 flex items-center gap-4 ${i < 6 ? "border-b border-gray-100" : ""}`}
        >
          <div className="h-3 w-14 bg-gray-100 rounded shrink-0"></div>
          <div className="w-36 shrink-0">
            <div className="h-4 w-28 bg-gray-100 rounded mb-1"></div>
            <div className="h-3 w-16 bg-gray-100 rounded"></div>
          </div>
          <div className="h-3 w-4 bg-gray-100 rounded shrink-0"></div>
          <div className="w-36 shrink-0">
            <div className="h-4 w-28 bg-gray-100 rounded mb-1"></div>
            <div className="h-3 w-16 bg-gray-100 rounded"></div>
          </div>
          <div className="flex-1" />
          <div className="w-20 shrink-0">
            <div className="h-3 w-16 bg-gray-100 rounded mb-1 ml-auto"></div>
            <div className="h-1 w-20 bg-gray-100 rounded"></div>
            <div className="h-3 w-10 bg-gray-100 rounded mt-1 ml-auto"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TournamentSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-6 w-28 rounded-full bg-gray-100" />
            <div className="h-5 w-14 rounded-full bg-gray-100" />
          </div>
          <div className="h-5 w-3/4 rounded bg-gray-100" />
          <div className="mt-3 h-4 w-1/2 rounded bg-gray-50" />
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">
              <div className="h-5 w-10 rounded-full bg-gray-50" />
              <div className="h-5 w-10 rounded-full bg-gray-50" />
              <div className="h-5 w-10 rounded-full bg-gray-50" />
            </div>
            <div className="h-5 w-12 rounded bg-gray-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

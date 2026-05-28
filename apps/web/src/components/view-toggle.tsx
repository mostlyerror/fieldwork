"use client";

export type ViewMode = "list" | "map";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div role="tablist" aria-label="View mode" className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5">
      <button
        role="tab"
        aria-selected={view === "list"}
        aria-label="List view"
        onClick={() => onChange("list")}
        className={`rounded-xl min-h-[40px] px-4 py-2 sm:min-h-0 sm:py-1.5 text-sm font-medium transition ${
          view === "list"
            ? "bg-green-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        List
      </button>
      <button
        role="tab"
        aria-selected={view === "map"}
        aria-label="Map view"
        onClick={() => onChange("map")}
        className={`rounded-xl min-h-[40px] px-4 py-2 sm:min-h-0 sm:py-1.5 text-sm font-medium transition ${
          view === "map"
            ? "bg-green-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Map
      </button>
    </div>
  );
}

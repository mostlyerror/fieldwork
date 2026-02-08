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
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      <button
        onClick={() => onChange("list")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          view === "list"
            ? "bg-green-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        List
      </button>
      <button
        onClick={() => onChange("map")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
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

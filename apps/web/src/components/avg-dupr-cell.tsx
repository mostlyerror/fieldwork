import type { AvgDuprPair } from "@/lib/dupr-utils";

export function AvgDuprCell({ pair, size = "sm" }: { pair: AvgDuprPair; size?: "sm" | "md" }) {
  const { listed, live, hasLiveData } = pair;
  const display = live ?? listed;
  if (display == null) return null;

  const showDelta = hasLiveData && listed != null && Math.abs(live! - listed) > 0.05;
  const delta = showDelta ? live! - listed! : 0;

  if (!showDelta) {
    return (
      <span className={`font-bold ${hasLiveData ? "text-emerald-600" : "text-gray-900"}`}>
        {display.toFixed(2)}
      </span>
    );
  }

  if (size === "sm") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-gray-400 line-through">{listed!.toFixed(2)}</span>
        <span className="font-bold text-emerald-600">{live!.toFixed(2)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-gray-400 line-through">{listed!.toFixed(2)}</span>
      <span className="font-bold text-emerald-600">{live!.toFixed(2)}</span>
      {delta > 0 ? (
        <span className="rounded bg-red-50 px-1 py-0.5 text-[10px] font-bold text-red-500">
          +{delta.toFixed(2)}
        </span>
      ) : (
        <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-bold text-blue-500">
          {delta.toFixed(2)}
        </span>
      )}
    </span>
  );
}

export type FieldStrengthLevel = "friendly" | "competitive" | "stacked" | "sandbagger";

export function getFieldStrengthLevel(
  avgFieldStrength?: number,
  maxSandbaggerPct?: number,
): FieldStrengthLevel | null {
  if (avgFieldStrength == null) return null;

  if (maxSandbaggerPct != null && maxSandbaggerPct > 0.4) return "sandbagger";
  if (avgFieldStrength > 0.75) return "stacked";
  if (avgFieldStrength >= 0.4) return "competitive";
  return "friendly";
}

const BADGE_CONFIG: Record<FieldStrengthLevel, { label: string; className: string }> = {
  friendly: {
    label: "Friendly Field",
    className: "bg-green-50 text-green-700 ring-green-200",
  },
  competitive: {
    label: "Competitive",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  stacked: {
    label: "Stacked",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  sandbagger: {
    label: "Sandbagger Alert",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

export function FieldStrengthBadge({
  avgFieldStrength,
  maxSandbaggerPct,
  size = "sm",
}: {
  avgFieldStrength?: number;
  maxSandbaggerPct?: number;
  size?: "sm" | "md";
}) {
  const level = getFieldStrengthLevel(avgFieldStrength, maxSandbaggerPct);
  if (!level) return null;

  const config = BADGE_CONFIG[level];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${config.className} ${sizeClass}`}
    >
      {level === "sandbagger" && (
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {config.label}
    </span>
  );
}

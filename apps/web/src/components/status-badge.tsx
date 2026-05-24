const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-50 text-green-700 ring-green-200",
  filling: "bg-amber-50 text-amber-700 ring-amber-200",
  full: "bg-red-50 text-red-700 ring-red-200",
  closed: "bg-gray-100 text-gray-500 ring-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  filling: "Filling Up",
  full: "Full",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "open";
  const style = STATUS_STYLES[s] ?? STATUS_STYLES.open;
  const label = STATUS_LABELS[s] ?? s;
  return (
    <span
      role="status"
      aria-label={`Registration ${label.toLowerCase()}`}
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${style}`}
    >
      {label}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  filling: "bg-amber-100 text-amber-800",
  full: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-500",
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
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

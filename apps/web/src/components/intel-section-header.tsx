export function IntelSectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-t-xl bg-[#065f46] px-4 py-2.5 text-white">
      <span className="t-label">{title}</span>
      {badge && (
        <span className="t-caption opacity-70">{badge}</span>
      )}
    </div>
  );
}

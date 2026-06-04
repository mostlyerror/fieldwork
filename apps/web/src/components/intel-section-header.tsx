export function IntelSectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between bg-[#065f46] px-5 py-3 text-white">
      <span className="t-label tracking-[0.12em]">{title}</span>
      {badge && (
        <span className="t-caption font-semibold opacity-75">{badge}</span>
      )}
    </div>
  );
}

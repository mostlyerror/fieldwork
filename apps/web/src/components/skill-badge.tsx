import { SKILL_LEVEL_COLORS } from "@/lib/constants";

export function SkillBadge({ level }: { level: string }) {
  const colors = SKILL_LEVEL_COLORS[level] ?? "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {level}
    </span>
  );
}

import type { TournamentSource } from "@/lib/types";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";

export function SourceLinks({ sources }: { sources: TournamentSource[] }) {
  const withUrl = sources.filter((s) => s.registration_url);
  if (withUrl.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="t-body font-semibold text-gray-700">Register</h3>
      <div className="flex flex-wrap gap-2">
        {withUrl.map((source) => (
          <a
            key={source.id}
            href={source.registration_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-700 px-4 py-2 t-body font-bold text-white transition hover:bg-emerald-800 active:scale-[0.98]"
          >
            Register on{" "}
            {SOURCE_DISPLAY_NAMES[source.source_platform] ??
              source.source_platform}
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

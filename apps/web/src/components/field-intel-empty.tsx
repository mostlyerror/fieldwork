import { fieldEmptyState, type FieldContext } from "@/lib/field-intel";

/** Radar-sweep glyph — quiet echo of the brand, used for the empty field state. */
function RadarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 19 7" />
    </svg>
  );
}

function Cta({ cta, className }: { cta: { label: string; href: string }; className?: string }) {
  return (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>
      {cta.label} &rarr;
    </a>
  );
}

/**
 * Shown when a bracket has no captured roster, so the field-intel surface reads
 * as intentional rather than broken. Two layouts: `panel` for the desktop
 * master-detail right pane, `inline` for a mobile event card body.
 */
export function FieldIntelEmpty({
  field,
  variant = "panel",
}: {
  field: FieldContext;
  variant?: "panel" | "inline";
}) {
  const { headline, sub, cta } = fieldEmptyState(field);

  if (variant === "inline") {
    return (
      <div className="border-t border-gray-100 bg-[#fbfcfb] px-4 py-3 pl-11 sm:px-5 sm:pl-12">
        <div className="flex items-start gap-2.5">
          <RadarIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300" />
          <div>
            <p className="t-caption font-semibold text-gray-600">{headline}</p>
            <p className="mt-0.5 t-caption text-gray-400">{sub}</p>
            {cta && (
              <Cta cta={cta} className="mt-1.5 inline-block t-caption font-bold text-emerald-700 hover:text-emerald-800" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <RadarIcon className="h-6 w-6" />
      </div>
      <p className="mt-4 t-body font-bold text-gray-900">{headline}</p>
      <p className="mt-1.5 max-w-xs t-caption text-gray-500">{sub}</p>
      {cta && (
        <Cta
          cta={cta}
          className="mt-5 inline-flex items-center rounded-full bg-emerald-700 px-4 py-2 t-caption font-bold text-white transition hover:bg-emerald-800"
        />
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

export type SegOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

/**
 * One segmented toggle used everywhere a single-select control is needed (view
 * mode, field-strength filter, …) so the browse controls share one visual
 * language instead of each being styled ad-hoc. Emerald accent, type-scale text.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`t-small inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 font-semibold transition active:scale-[0.97] ${
              active
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

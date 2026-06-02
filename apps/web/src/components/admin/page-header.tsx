import type { ReactNode } from "react";

/**
 * Standard header for every admin page: bold title + muted subtitle on the left,
 * an optional action slot on the right. Pass `action` already wrapped in its own
 * element so each page keeps control of its responsive visibility.
 */
export function AdminPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className ?? ""}`}
    >
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-emerald-950 lg:text-[26px]">
          {title}
        </h1>
        {subtitle != null && (
          <p className="mt-1 max-w-[640px] text-[13px] font-medium text-emerald-900/45">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

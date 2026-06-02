import Link from "next/link";
import { RadarMark } from "./radar-mark";

/**
 * Shared chrome for every auth screen (login, forgot-password, reset-password).
 * Desktop (≥1024px): emerald brand panel on the left, cream form column on the
 * right. Mobile: emerald header strip + a bordered cream card. Pages pass their
 * heading/form as `children`; everything around it stays identical by design.
 *
 * Class constants are exported so each page styles its fields/buttons the same.
 */

export const authHeadingClass =
  "mb-1.5 text-[1.65rem] font-extrabold leading-tight tracking-[-0.03em] text-[#0a0a0a]";
export const authSubcopyClass =
  "mb-7 text-[0.83rem] leading-[1.55] text-[#6b7280]";
export const authLabelClass =
  "mb-1.5 block text-[0.78rem] font-semibold tracking-[0.01em] text-[#0a0a0a]";
export const authInputClass =
  "w-full min-h-[44px] appearance-none rounded-[10px] border-2 border-[#d1d5db] bg-white px-3.5 py-[11px] text-base text-[#0a0a0a] outline-none transition-[border-color,box-shadow] placeholder:text-[#9ca3af] focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]";
export const authButtonClass =
  "block w-full min-h-[48px] rounded-full bg-[#047857] px-5 py-[13px] text-center text-[0.88rem] font-bold tracking-[0.01em] text-white transition hover:bg-[#065f46] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const authLinkClass = "font-semibold text-[#047857] hover:underline";
export const authErrorClass =
  "mb-4 rounded-[10px] border border-red-200 bg-red-50 p-3 text-[0.8rem] leading-snug text-red-700";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop brand panel */}
      <aside
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#065f46] px-[52px] py-14 lg:flex"
        aria-hidden="true"
      >
        <svg
          className="pointer-events-none absolute -bottom-[90px] -right-[90px] h-[340px] w-[340px]"
          viewBox="0 0 340 340"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="340" cy="340" r="150" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
          <circle cx="340" cy="340" r="108" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" fill="none" />
          <circle cx="340" cy="340" r="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
          <path d="M340 340 L190 340 A150 150 0 0 1 340 190 Z" fill="#d4af37" opacity="0.10" />
          <path d="M190 340 A150 150 0 0 1 340 190" stroke="#d4af37" strokeWidth="1.5" fill="none" opacity="0.40" />
        </svg>

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <RadarMark size={38} />
          <span className="text-[1.2rem] font-extrabold tracking-[-0.02em] text-white">
            PickleRadar
          </span>
        </Link>

        <div className="relative z-10 mt-auto mb-9">
          <p className="mb-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white/60">
            Tournament intelligence
          </p>
          <p className="text-[1.85rem] font-extrabold leading-[1.2] tracking-[-0.03em] text-white">
            Know what you&rsquo;re walking into
            <br />
            <span className="text-[#d4af37]">before you register.</span>
          </p>
        </div>

        <div className="relative z-10 text-[0.7rem] tracking-[0.04em] text-white/35">
          Made in Houston &nbsp;&middot;&nbsp; pickleradar.app
        </div>
      </aside>

      {/* Mobile header strip */}
      <header className="flex items-center gap-2.5 bg-[#065f46] px-5 py-[18px] lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <RadarMark size={28} />
          <span className="text-base font-extrabold tracking-[-0.02em] text-white">
            PickleRadar
          </span>
        </Link>
      </header>

      {/* Form column */}
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 lg:items-center lg:px-10 lg:py-12">
        <div className="w-full max-w-[440px] rounded-2xl border-2 border-[#1a1a1a] bg-cream px-7 py-8 lg:max-w-[400px] lg:rounded-none lg:border-0 lg:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import DesignSwitcher from "../design-switcher";

export default function Design4() {
  return (
    <div className="min-h-screen bg-white">
      {/* Spacer */}
      <div className="flex h-[50vh] items-end justify-center px-5 pb-8">
        <p className="text-sm text-gray-300">
          (tournament list would be above)
        </p>
      </div>

      {/* ── Design 4: Minimal & Clean ── */}
      {/* Maximum whitespace, restrained typography, single-line CTA */}
      <section className="mx-auto max-w-6xl px-5">
        <div className="border-t border-gray-100" />
        <div className="flex flex-col items-center justify-between gap-4 py-16 sm:flex-row">
          <p className="text-lg text-gray-400">
            Missing a tournament?
          </p>
          <Link
            href="/submit"
            className="group flex items-center gap-3 text-lg font-medium text-gray-900 transition-colors hover:text-green-700"
          >
            Submit it
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-sm transition-all group-hover:border-green-600 group-hover:bg-green-600 group-hover:text-white">
              {"\u2192"}
            </span>
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5">
        <div className="border-t border-gray-100" />
        <div className="py-16">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{"\u{1F3D3}"}</span>
                <span className="text-base font-bold text-green-700">
                  PickleRadar
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Every upcoming Houston
                <br />
                pickleball tournament,
                <br />
                one search away.
              </p>
            </div>

            {/* Links */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-300">
                Links
              </p>
              <div className="space-y-2">
                <Link
                  href="/"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Browse tournaments
                </Link>
                <Link
                  href="/submit"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Submit a tournament
                </Link>
              </div>
            </div>

            {/* Connect */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-300">
                Connect
              </p>
              <div className="space-y-2">
                <a
                  href="mailto:hello@pickleradar.app"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  hello@pickleradar.app
                </a>
                <a
                  href="https://instagram.com/pickleradar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-gray-500 transition-colors hover:text-gray-800"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-50 pt-6">
            <p className="text-xs text-gray-300">
              Made with {"\u{1F49A}"} for the Houston pickleball community
            </p>
          </div>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}

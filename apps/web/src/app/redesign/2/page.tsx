import Link from "next/link";
import DesignSwitcher from "../design-switcher";

export default function Design2() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-amber-50/20">
      {/* Spacer */}
      <div className="flex h-[50vh] items-end justify-center px-5 pb-8">
        <p className="text-sm text-gray-300">
          (tournament list would be above)
        </p>
      </div>

      {/* ── Design 2: Warm & Conversational ── */}
      {/* Friendly, approachable card with casual language and warm tones */}
      <section className="mx-auto max-w-3xl px-5 pb-16">
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50 px-8 py-10 text-center shadow-sm sm:px-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">{"\u{1F64B}"}</span>
          </div>
          <h2 className="mt-5 text-2xl font-bold text-gray-900">
            Hey, we probably missed some!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-gray-500">
            We scrape the web but we&apos;re not perfect. If you know about a
            tournament that&apos;s not listed, drop us a link and our AI will do
            the rest.
          </p>
          <Link
            href="/submit"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 transition-all hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-200"
          >
            Submit a tournament
            <span className="text-base">{"\u2192"}</span>
          </Link>
          <p className="mt-3 text-xs text-amber-600/60">
            Takes about 30 seconds
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{"\u{1F3D3}"}</span>
              <div>
                <p className="text-base font-bold text-green-700">
                  PickleRadar
                </p>
                <p className="text-xs text-gray-400">
                  Your Houston pickleball community
                </p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <a
                href="mailto:hello@pickleradar.app"
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                Say hello
              </a>
              <a
                href="https://instagram.com/pickleradar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                Follow us
              </a>
              <Link
                href="/submit"
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                Submit event
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-50 pt-6 text-center">
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

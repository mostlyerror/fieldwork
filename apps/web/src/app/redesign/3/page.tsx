import Link from "next/link";
import DesignSwitcher from "../design-switcher";

export default function Design3() {
  return (
    <div className="min-h-screen bg-white">
      {/* Spacer */}
      <div className="flex h-[50vh] items-end justify-center px-5 pb-8">
        <p className="text-sm text-gray-300">
          (tournament list would be above)
        </p>
      </div>

      {/* ── Design 3: Dark & Premium ── */}
      {/* Dark section that creates contrast, feels high-end and serious */}
      <section className="bg-gray-950">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
          {/* Left — copy */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-green-400">
                Community-powered
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              The tournament
              <br />
              <span className="text-green-400">you&apos;re looking for</span>
              <br />
              might not be here yet.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-gray-400">
              PickleRadar gets better with every submission. Paste a link, and
              our AI extracts all the details automatically.
            </p>
          </div>

          {/* Right — CTA card */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <span className="text-lg">{"\u{1F3D3}"}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Submit a tournament
                </p>
                <p className="text-xs text-gray-500">
                  AI-assisted, 30 seconds
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 text-xs text-green-400">
                  1
                </span>
                Paste a tournament link
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 text-xs text-green-400">
                  2
                </span>
                AI reads the page and fills in details
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 text-xs text-green-400">
                  3
                </span>
                Review, tweak, and submit
              </div>
            </div>

            <Link
              href="/submit"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3.5 text-sm font-bold text-gray-950 transition-all hover:bg-green-400"
            >
              Get started
              <span>{"\u2192"}</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-gray-950 border-t border-gray-800/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="text-xl">{"\u{1F3D3}"}</span>
              <span className="font-bold text-white">PickleRadar</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-500">
              <a
                href="mailto:hello@pickleradar.app"
                className="transition-colors hover:text-gray-300"
              >
                Feedback
              </a>
              <a
                href="https://instagram.com/pickleradar"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-gray-300"
              >
                Instagram
              </a>
            </div>

            <p className="text-xs text-gray-600">
              Made with {"\u{1F49A}"} for Houston pickleball
            </p>
          </div>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}

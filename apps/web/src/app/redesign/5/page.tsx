import Link from "next/link";
import DesignSwitcher from "../design-switcher";

export default function Design5() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50/30">
      {/* Spacer */}
      <div className="flex h-[50vh] items-end justify-center px-5 pb-8">
        <p className="text-sm text-gray-300">
          (tournament list would be above)
        </p>
      </div>

      {/* ── Design 5: Playful & Energetic ── */}
      {/* Bright, fun, emoji-forward with bouncy feel */}
      <section className="relative mx-auto max-w-5xl px-5 pb-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 p-1">
          <div className="rounded-[20px] bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 px-6 py-14 text-center sm:px-12">
            {/* Floating emoji decoration */}
            <div className="mb-6 flex items-center justify-center gap-3">
              <span className="inline-block -rotate-12 text-3xl opacity-80">
                {"\u{1F3D3}"}
              </span>
              <span className="inline-block rotate-6 text-2xl opacity-60">
                {"\u{1F3C6}"}
              </span>
              <span className="inline-block -rotate-3 text-3xl opacity-80">
                {"\u{1F525}"}
              </span>
            </div>

            <h2 className="text-3xl font-extrabold text-white md:text-4xl">
              We need your help!
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-green-100/80">
              PickleRadar is built by the community, for the community. Spotted a
              tournament that&apos;s not on our radar? Submit it in seconds.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-green-700 shadow-lg shadow-green-900/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <span className="text-lg">+</span>
                Submit a Tournament
              </Link>
              <span className="text-sm text-green-200/60">
                AI-powered — just paste a link
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <div className="flex flex-col items-center gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <span className="text-3xl">{"\u{1F3D3}"}</span>
              <span className="text-xl font-bold text-green-700">
                PickleRadar
              </span>
            </div>

            {/* Links as pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-green-300 hover:text-green-700"
              >
                Browse
              </Link>
              <Link
                href="/submit"
                className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-green-300 hover:text-green-700"
              >
                Submit
              </Link>
              <a
                href="mailto:hello@pickleradar.app"
                className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-green-300 hover:text-green-700"
              >
                Feedback
              </a>
              <a
                href="https://instagram.com/pickleradar"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-green-300 hover:text-green-700"
              >
                Instagram
              </a>
            </div>

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

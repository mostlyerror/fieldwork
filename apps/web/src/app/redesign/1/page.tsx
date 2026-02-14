import Link from "next/link";
import DesignSwitcher from "../design-switcher";

export default function Design1() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50/30">
      {/* Spacer to simulate page content above */}
      <div className="flex h-[50vh] items-end justify-center px-5 pb-8">
        <p className="text-sm text-gray-300">
          (tournament list would be above)
        </p>
      </div>

      {/* ── Design 1: Bold Community Rally ── */}
      {/* Full-bleed green CTA section with large type and a strong call to action */}
      <section className="relative overflow-hidden bg-green-700">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-[0.07]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-green-200">
            Help the community grow
          </p>
          <h2 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">
            Know about a tournament
            <br />
            we&apos;re missing?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-green-100/80">
            It takes 30 seconds to submit. Our AI reads the link and fills in
            the details for you.
          </p>
          <Link
            href="/submit"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-green-700 shadow-xl shadow-green-900/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-green-900/40"
          >
            <span className="text-xl">+</span>
            Submit a Tournament
          </Link>
        </div>
      </section>

      <footer className="bg-green-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{"\u{1F3D3}"}</span>
            <span className="text-lg font-bold text-white">PickleRadar</span>
          </div>
          <p className="text-sm text-green-200/70">
            Made with {"\u{1F49A}"} for the Houston pickleball community
          </p>
          <div className="flex items-center gap-4 text-sm text-green-200/70">
            <a
              href="mailto:hello@pickleradar.app"
              className="transition-colors hover:text-white"
            >
              Feedback
            </a>
            <a
              href="https://instagram.com/pickleradar"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}

import Link from "next/link";
import { FooterSubscribe } from "./footer-subscribe";

export function Footer({ citySlug }: { citySlug?: string }) {
  const browseHref = citySlug ? `/${citySlug}` : "/houston";

  return (
    <footer className="mt-20 border-t-2 border-gray-900">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <p className="text-lg font-extrabold tracking-tight text-gray-900">
              PickleRadar
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Tournament intel for competitive pickleball players.
              Real DUPR ratings. Sandbagger detection. Know what
              you&apos;re walking into before you register.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Navigate
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href={browseHref} className="text-gray-600 hover:text-emerald-700">
                Browse tournaments
              </Link>
              <Link href="/submit" className="text-gray-600 hover:text-emerald-700">
                Submit a tournament
              </Link>
              <a href="mailto:hello@pickleradar.app" className="text-gray-600 hover:text-emerald-700">
                Contact us
              </a>
            </div>
          </div>

          {/* Social + subscribe hook */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Stay in the loop
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Weekly tournament updates delivered to your inbox.
            </p>
            <FooterSubscribe />
            <a
              href="https://instagram.com/pickleradar"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-gray-600 hover:text-emerald-700"
            >
              Instagram
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-6 text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} PickleRadar</p>
          <p>
            Made in Houston with real player data
          </p>
        </div>
      </div>
    </footer>
  );
}

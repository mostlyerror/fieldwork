import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏓</span>
          <span className="text-xl font-bold text-green-600">PickleRadar</span>
        </Link>
        <p className="hidden text-sm text-gray-500 sm:block">
          Houston-area pickleball tournaments
        </p>
      </div>
    </header>
  );
}

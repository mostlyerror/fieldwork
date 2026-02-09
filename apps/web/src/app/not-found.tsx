import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-5">
      <span className="text-6xl">🏓</span>
      <h1 className="mt-4 text-5xl font-bold text-gray-200">404</h1>
      <p className="mt-2 text-lg text-gray-500">
        This page went out of bounds.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
      >
        Back to tournaments
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold text-gray-300">404</h1>
      <p className="mt-2 text-gray-600">Page not found</p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm font-medium text-green-600 hover:text-green-700"
      >
        ← Back to tournaments
      </Link>
    </div>
  );
}

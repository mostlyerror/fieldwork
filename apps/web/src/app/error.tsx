"use client";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-5">
      <span className="text-6xl">😵</span>
      <h1 className="mt-4 text-2xl font-bold text-gray-700">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        We hit an unexpected error loading this page.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

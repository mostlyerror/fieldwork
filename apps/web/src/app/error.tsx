"use client";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold text-gray-300">Oops</h1>
      <p className="mt-2 text-gray-600">Something went wrong loading tournaments.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Try again
      </button>
    </div>
  );
}

import Link from "next/link";
import { PaddleIcon } from "@/components/paddle-icon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center">
      <div className="animate-paddle">
        <PaddleIcon size={88} />
      </div>
      <h1 className="mt-6 text-7xl font-black tracking-tight text-gray-200 animate-fade-up">
        Out!
      </h1>
      <p className="mt-2 text-lg font-medium text-gray-600 animate-fade-up stagger-1">
        Couldn&apos;t find that one.
      </p>
      <p className="mt-1 text-sm text-gray-400 animate-fade-up stagger-2">
        Either the link&apos;s wrong or this tournament rolled out of bounds.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-800 hover:-translate-y-0.5 animate-fade-up stagger-3"
      >
        Back to tournaments
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

import Link from "next/link";
import { LoginForm } from "./login-form";
import { DevQuickLogin } from "./dev-quick-login";

export const metadata = {
  title: "Log In — PickleRadar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect, error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-3xl">{"\u{1F3D3}"}</span>
          <span className="text-2xl font-bold text-green-700">PickleRadar</span>
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 className="mb-6 text-center text-xl font-bold text-gray-900">
            Log in to your account
          </h1>

          {error === "auth" && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Authentication failed. Please try again.
            </div>
          )}

          <LoginForm redirect={redirect} />
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link
            href="/forgot-password"
            className="font-medium text-green-600 hover:text-green-700"
          >
            Forgot password?
          </Link>
        </p>

        <DevQuickLogin />
      </div>
    </div>
  );
}

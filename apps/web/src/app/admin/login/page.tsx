import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const alreadyLoggedIn = await verifyAdminSession();
  if (alreadyLoggedIn) redirect("/admin");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 p-5">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="text-4xl">{"\u{1F3D3}"}</span>
          <h1 className="text-2xl font-bold text-green-700">PickleRadar</h1>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Admin Login
          </p>
        </div>

        <form
          action={loginAction}
          className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100"
        >
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mb-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
            placeholder="Enter admin password"
          />

          {error && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              Invalid password. Try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}

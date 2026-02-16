import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Sign Up — PickleRadar",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-3xl">{"\u{1F3D3}"}</span>
          <span className="text-2xl font-bold text-green-700">PickleRadar</span>
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 className="mb-2 text-center text-xl font-bold text-gray-900">
            Create your account
          </h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            Get personalized tournament recommendations
          </p>

          <SignupForm redirect={redirect} />
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="font-medium text-green-600 hover:text-green-700"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

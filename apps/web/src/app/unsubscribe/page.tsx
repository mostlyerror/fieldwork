import { getSupabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";

export const metadata = {
  title: "Unsubscribe — PickleRadar",
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Message title="Invalid link" body="This unsubscribe link is missing a token." />;
  }

  let email: string;
  try {
    email = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return <Message title="Invalid link" body="This unsubscribe link is malformed." />;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return <Message title="Invalid link" body="This unsubscribe link is malformed." />;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("email_subscribers")
    .update({ status: "unsubscribed" })
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("Unsubscribe error:", error);
    return (
      <Message
        title="Something went wrong"
        body="We couldn't process your request. Please try again later."
      />
    );
  }

  return (
    <Message
      title="You've been unsubscribed"
      body="You won't receive any more weekly digest emails from PickleRadar. Changed your mind? Just re-subscribe on our homepage."
    />
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50/50 via-white to-amber-50/30 px-3 py-5 sm:p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-sm ring-1 ring-gray-100">
        <span className="text-4xl">{"🏓"}</span>
        <h1 className="mt-4 t-h2 font-bold text-gray-800">{title}</h1>
        <p className="mt-2 t-body text-gray-500">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-green-600 px-6 py-2.5 t-body font-semibold text-white transition-colors hover:bg-green-700"
        >
          Back to PickleRadar
        </Link>
      </div>
    </div>
  );
}

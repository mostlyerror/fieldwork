import { LoginForm } from "./login-form";
import { DevQuickLogin } from "./dev-quick-login";
import {
  AuthShell,
  authErrorClass,
  authHeadingClass,
  authSubcopyClass,
} from "@/components/auth/auth-shell";

export const metadata = {
  title: "Sign in — PickleRadar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect, error } = await searchParams;

  return (
    <AuthShell>
      <h1 className={authHeadingClass}>Welcome back</h1>
      <p className={authSubcopyClass}>
        Sign in to track tournaments, get alerts, and stay ahead of the field.
      </p>

      {error === "auth" && (
        <div className={authErrorClass}>
          Authentication failed. Please try again.
        </div>
      )}

      <LoginForm redirect={redirect} />

      <DevQuickLogin />
    </AuthShell>
  );
}

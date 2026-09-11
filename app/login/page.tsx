"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trackClient } from "@/lib/billing/usage-client";
import { EVENTS } from "@/lib/analytics/event-names";
import { BrandMark } from "@/components/logo";
import SegmentedControl from "@/components/segmented-control";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Surface Google-auth callback failures (?google=&reason=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (!google) return;
    const reason = params.get("reason");
    setError(
      google === "denied"
        ? "You cancelled the Google sign-in. Try again or use email."
        : reason === "config"
          ? "Sign in with Google is not configured yet. Please try email."
          : "Google sign-in failed. Please try again or use email."
    );
  }, []);

  // Already signed in? Skip the login screen.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        router.replace("/dashboard");
        return;
      }

      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirm) throw new Error("Passwords do not match.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/api/auth/callback` }
        });
        if (error) throw new Error(error.message);
        if (!data.session) {
          setSent(true);
          return;
        }
        // Session flow: fire the activation signal before the dashboard paints.
        void trackClient(EVENTS.SIGNUP_COMPLETED, { method: "password" });
        router.replace("/dashboard");
        return;
      }

      // mode === "reset"
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/api/auth/callback?next=reset-password`
      });
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, { h1: string; p: string; button: string }> = {
    signin: {
      h1: "Welcome back",
      p: "One recording, three drafts — ready to edit.",
      button: "Sign in"
    },
    signup: {
      h1: "Create your account",
      p: "Free during beta — no credit card needed.",
      button: "Create account"
    },
    reset: {
      h1: "Reset your password",
      p: "We'll email you a link to set a new one.",
      button: "Send reset link"
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <div>
            <h1 className="font-display text-2xl font-bold">{titles[mode].h1}</h1>
            <p className="mt-1 text-sm text-theme-text-secondary">{titles[mode].p}</p>
          </div>
        </div>

        <div className="rounded-lg border border-theme-divider bg-theme-bg-paper p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                  aria-hidden="true"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22l-4-9-9-4z" />
                </svg>
              </span>
              <p className="text-sm font-medium text-theme-text-primary">
                {mode === "reset" ? "Check your email" : "Confirm your email"}
              </p>
              <p className="text-sm text-theme-text-secondary">
                {mode === "reset" ? (
                  <>
                    We sent a password-reset link to{" "}
                    <span className="font-semibold">{email}</span>.
                  </>
                ) : (
                  <>
                    We sent a confirmation link to <span className="font-semibold">{email}</span>.
                    Once you confirm, you can sign in.
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              {mode !== "reset" && (
                <>
                  <a href="/api/auth/google/connect" className="btn btn-outline-primary w-full">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
                      />
                    </svg>
                    Continue with Google
                  </a>

                  <div className="flex items-center gap-3 py-1" aria-hidden="true">
                    <span className="h-px flex-1 bg-theme-divider" />
                    <span className="text-xs text-theme-text-secondary">or</span>
                    <span className="h-px flex-1 bg-theme-divider" />
                  </div>
                </>
              )}
              {mode !== "reset" && (
                <SegmentedControl
                  ariaLabel="Sign in or create an account"
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setError(null);
                  }}
                  containerClassName="mb-5 grid grid-cols-2 p-1"
                  segmentClassName="rounded-md"
                  options={[
                    { id: "signin", label: "Sign in" },
                    { id: "signup", label: "Create account" }
                  ]}
                />
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-control"
                  />
                </div>

                {mode !== "reset" && (
                  <div>
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-control pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-theme-text-secondary transition-colors hover:text-theme-text-primary"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {mode === "signup" && (
                      <p className="mt-1 text-xs text-theme-text-secondary">
                        At least 8 characters.
                      </p>
                    )}
                  </div>
                )}

                {mode === "signup" && (
                  <div>
                    <label htmlFor="confirm" className="form-label">
                      Confirm password
                    </label>
                    <input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="form-control"
                    />
                  </div>
                )}

                {mode === "signin" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                      }}
                      className="text-xs font-medium text-primary-500 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                  {busy ? "Please wait…" : titles[mode].button}
                </button>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </form>
            </>
          )}
        </div>

        {mode !== "reset" && (
          <p className="mt-4 text-center text-xs text-theme-text-secondary">
            Beta is free — your first 5 VervAI jobs every month are on us. No card, no auto-renew.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-theme-text-secondary">
          <Link href="/" className="font-medium text-primary-500 hover:underline">
            ← Back to home
          </Link>
          <span className="mx-2 text-theme-text-secondary/60">·</span>
          <Link href="/legal/terms" className="hover:underline">
            Terms
          </Link>
          <span className="mx-2 text-theme-text-secondary/60">·</span>
          <Link href="/legal/privacy" className="hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}
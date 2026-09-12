"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TextInput from "@/components/ui/TextInput";
import PasswordField from "@/components/ui/PasswordField";
import Checkbox from "@/components/ui/Checkbox";
import Icon from "@/components/ui/Icon";

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
    router.push(redirectTo);
    router.refresh();
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || resetSent || status === "submitting") return;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/preferences`,
    });
    if (!error) setResetSent(true);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label className="font-caption-bold text-caption-bold text-on-surface" htmlFor="work-email">
          Email
        </label>
        <TextInput
          id="work-email"
          leadingIcon="mail"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="[&_input]:rounded-lg [&_input]:bg-surface-container-lowest"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="font-caption-bold text-caption-bold text-on-surface" htmlFor="auth-password">
            Password
          </label>
          {resetSent ? (
            <span className="font-caption-bold text-caption-bold text-tertiary">
              Reset link sent
            </span>
          ) : (
            <button
              className="font-caption-bold text-caption-bold text-primary hover:underline disabled:opacity-50"
              type="button"
              onClick={handleForgotPassword}
              disabled={!email.trim()}
            >
              Forgot password?
            </button>
          )}
        </div>
        <PasswordField
          id="auth-password"
          leadingIcon="lock"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="[&_input]:rounded-lg [&_input]:bg-surface-container-lowest"
        />
      </div>

      <div className="pt-1">
        <Checkbox
          id="remember-device"
          checked={remember}
          onChange={() => setRemember((v) => !v)}
          label="Keep me signed in"
        />
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          <Icon name="error" size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="pt-2">
        <button
          className="w-full py-2.5 px-5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] group disabled:opacity-60 disabled:pointer-events-none"
          type="submit"
          disabled={status === "submitting" || status === "success"}
        >
          {status === "submitting" ? (
            <svg className="animate-spin h-5 w-5 text-on-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : status === "success" ? (
            <>Signed in!</>
          ) : (
            <>
              <span>Sign In</span>
              <Icon name="arrow_forward" size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>

      <p className="pt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link className="font-caption-bold text-caption-bold text-primary hover:underline ml-1" href="/sign-up">
          Create an account
        </Link>
      </p>
    </form>
  );
}
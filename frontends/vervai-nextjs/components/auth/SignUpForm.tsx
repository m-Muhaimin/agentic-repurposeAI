"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TextInput from "@/components/ui/TextInput";
import PasswordField from "@/components/ui/PasswordField";
import Checkbox from "@/components/ui/Checkbox";
import Icon from "@/components/ui/Icon";

export default function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/sign-in?registered=true"), 1200);
  };

  return (
    <form className="space-y-4" id="verv-register-form" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-caption-bold text-caption-bold text-on-surface mb-1.5" htmlFor="full-name">
            Full Name
          </label>
          <TextInput
            id="full-name"
            autoComplete="name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="[&_input]:rounded-lg [&_input]:bg-surface-container-low [&_input]:focus:bg-surface-container"
          />
        </div>
        <div>
          <label className="block font-caption-bold text-caption-bold text-on-surface mb-1.5" htmlFor="signup-email">
            Email
          </label>
          <TextInput
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="[&_input]:rounded-lg [&_input]:bg-surface-container-low [&_input]:focus:bg-surface-container"
          />
        </div>
      </div>

      <div>
        <label className="block font-caption-bold text-caption-bold text-on-surface mb-1.5" htmlFor="signup-password">
          Password
        </label>
        <PasswordField
          id="signup-password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="[&_input]:rounded-lg [&_input]:bg-surface-container-low [&_input]:focus:bg-surface-container"
        />
      </div>

      <div className="pt-2">
        <Checkbox
          name="terms"
          defaultChecked
          label={
            <>
              I agree to the{" "}
              <Link className="text-primary hover:underline font-medium" href="/pricing">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link className="text-on-surface hover:text-primary hover:underline font-medium" href="/pricing">
                Privacy Policy
              </Link>
              .
            </>
          }
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
          className="w-full py-2.5 px-5 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary-container transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
          id="submit-register"
          type="submit"
          disabled={status === "submitting" || status === "success"}
        >
          {status === "submitting" ? (
            <svg className="animate-spin h-5 w-5 text-on-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : status === "success" ? (
            <>Account created! Check your email to verify.</>
          ) : (
            <>
              <span>Create Account</span>
              <Icon name="arrow_forward" size={18} />
            </>
          )}
        </button>
      </div>

      <p className="pt-4 text-center font-body-sm text-body-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link className="font-caption-bold text-caption-bold text-primary hover:underline ml-1" href="/sign-in">
          Sign In
        </Link>
      </p>
    </form>
  );
}
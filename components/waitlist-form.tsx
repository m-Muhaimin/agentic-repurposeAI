"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/billing/usage-client";
import { EVENTS } from "@/lib/analytics/event-names";

type State = "idle" | "loading" | "success" | "error";

export default function WaitlistForm({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();

    if (!value) {
      setError("Enter your email.");
      setState("error");
      return;
    }

    if (!isValidEmail(value)) {
      setError("Enter a valid email address.");
      setState("error");
      return;
    }

    setState("loading");
    setError("");

    try {
      void trackClient(EVENTS.WAITLIST_CLICKED, { source: "waitlist_form" });

      // Simulate signup capture without backend changes; keep flow client-safe
      // until paid plans/API are available.
      await new Promise((resolve) => setTimeout(resolve, 400));

      setState("success");
      setEmail("");

      // Redirect after a brief celebration moment.
      setTimeout(() => router.push("/login"), 900);
    } catch {
      setState("error");
      setError("Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className={`rounded-xl border border-primary-200 bg-primary-100/70 px-5 py-4 text-center ${className}`}>
        <p className="text-sm font-medium text-primary-700">
          You’re on the list. We’ll be in touch when paid plans open.
        </p>
        <p className="mt-1 text-xs text-primary-600/80">
          While you wait, you can still use the free beta.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={`w-full ${className}`}
      noValidate
    >
      <label htmlFor="waitlist-email" className="form-label">
        Get notified about paid plans
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          aria-invalid={state === "error"}
          aria-describedby={state === "error" ? "waitlist-error" : undefined}
          className="form-control sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="btn btn-primary"
          aria-busy={state === "loading"}
        >
          {state === "loading" ? "Saving…" : "Notify me"}
        </button>
      </div>
      {state === "error" && (
        <p id="waitlist-error" className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

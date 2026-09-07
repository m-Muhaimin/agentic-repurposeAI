"use client";

import { useEffect, useState } from "react";
import { PAID_PLAN_IDS, type PaidPlanId } from "@/lib/billing/paddle";

export default function PricingCheckout({
  availablePlans
}: {
  availablePlans: PaidPlanId[];
}) {
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: PaidPlanId) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan })
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  if (availablePlans.length === 0) {
    return (
      <p className="text-center text-sm text-theme-text-secondary">
        Paid plans aren&apos;t available yet. Join the waitlist and we&apos;ll notify you at launch.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {PAID_PLAN_IDS.map((plan) => {
        const available = availablePlans.includes(plan);
        return (
          <button
            key={plan}
            type="button"
            disabled={!available || loadingPlan !== null}
            onClick={() => handleCheckout(plan)}
            className="btn w-full bg-white text-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan === plan ? "Starting checkout…" : available ? `Upgrade to ${plan}` : "Coming soon"}
          </button>
        );
      })}
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      <p className="text-center text-xs text-neutral-400">
        Secure checkout via Paddle. Taxes may apply.
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/billing/usage-client";
import { EVENTS } from "@/lib/analytics/event-names";

export default function WaitlistLink({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        void trackClient(EVENTS.WAITLIST_CLICKED, { source: "landing_pricing" });
        router.push("/login");
      }}
      className={className}
    >
      Join the waitlist
    </button>
  );
}
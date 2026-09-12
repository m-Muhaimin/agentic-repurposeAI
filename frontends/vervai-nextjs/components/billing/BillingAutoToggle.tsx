"use client";

import { useState } from "react";
import Toggle from "@/components/ui/Toggle";

export default function BillingAutoToggle() {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="flex items-center gap-space-sm self-start sm:self-center">
      <Toggle checked={enabled} onChange={setEnabled} />
      <span className="font-body-sm text-body-sm text-on-surface font-semibold" id="refill-status-text">
        {enabled ? "Enabled (+10 pack threshold)" : "Disabled"}
      </span>
    </div>
  );
}
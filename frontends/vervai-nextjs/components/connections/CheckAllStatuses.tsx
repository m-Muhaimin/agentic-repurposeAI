"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

export default function CheckAllStatuses() {
  const [status, setStatus] = useState<"idle" | "checking" | "done">("idle");

  const runCheck = () => {
    if (status === "checking") return;
    setStatus("checking");
    setTimeout(() => setStatus("done"), 1400);
  };

  return (
    <button
      className="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-body-medium text-body-medium hover:bg-surface-container-high transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:pointer-events-none"
      type="button"
      onClick={runCheck}
      disabled={status === "checking"}
    >
      <Icon
        name={status === "done" ? "check_circle" : "sync"}
        size={18}
        className={`text-on-surface-variant ${status === "checking" ? "animate-spin" : ""} ${
          status === "done" ? "text-tertiary" : ""
        }`}
      />
      <span>
        {status === "checking"
          ? "Checking statuses…"
          : status === "done"
          ? "All statuses verified"
          : "Check All Statuses"}
      </span>
    </button>
  );
}
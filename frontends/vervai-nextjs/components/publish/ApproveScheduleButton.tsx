"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "saving" | "saved" | "error";

type ApproveScheduleButtonProps = {
  jobId: string;
  title: string;
  scheduledAt?: string | null;
};

export default function ApproveScheduleButton({
  jobId,
  title,
  scheduledAt,
}: ApproveScheduleButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");

  const handleApprove = async () => {
    if (status === "saving" || status === "saved") return;
    setStatus("saving");
    setErrorText("");

    const client = createClient();
    const { data } = await client.auth.getUser();
    if (!data.user) {
      setStatus("error");
      setErrorText("Sign-in required.");
      return;
    }

    const { data: updated, error } = await client
      .from("v4_distribution_jobs")
      .update({
        status: "scheduled",
        scheduled_at:
          scheduledAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .eq("id", jobId)
      .select();

    if (error) {
      setStatus("error");
      setErrorText(error.message);
      return;
    }
    if (!updated || updated.length === 0) {
      setStatus("error");
      setErrorText("Job no longer exists.");
      return;
    }

    setStatus("saved");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleApprove}
        loading={status === "saving"}
        disabled={status === "saved"}
        variant={status === "saved" ? "tertiary" : "primary"}
        title={`Approve & schedule ${title}`}
      >
        {status === "saved"
          ? "✓ Scheduled"
          : status === "saving"
            ? "Scheduling…"
            : "Approve & Schedule"}
      </Button>
      {status === "error" && errorText ? (
        <span className="font-body-sm text-body-sm text-error">{errorText}</span>
      ) : null}
    </div>
  );
}
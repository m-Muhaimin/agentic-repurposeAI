"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type IdeaApproveButtonProps = {
  ideaId: string;
  label?: string;
};

export default function IdeaApproveButton({
  ideaId,
  label = "Approve",
}: IdeaApproveButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("error");
      setError("Sign in required to approve ideas.");
      return;
    }
    const { error: updateError } = await supabase
      .from("v4_content_ideas")
      .update({ approved: true })
      .eq("id", ideaId);
    if (updateError) {
      setState("error");
      setError(updateError.message);
      return;
    }
    setState("saved");
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="sm"
        loading={state === "saving"}
        disabled={state === "saved"}
        onClick={handleApprove}
      >
        {state === "saved" ? "✓ Approved" : label}
      </Button>
      {state === "error" && error ? (
        <span className="font-body-sm text-body-sm text-error">{error}</span>
      ) : null}
    </div>
  );
}
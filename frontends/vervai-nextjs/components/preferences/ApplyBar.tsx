"use client";

import { Button } from "@/components/ui/Button";

type Status = "idle" | "saving" | "saved" | "error";

// Same pattern as AgentDefaults: props are typed optional because the server
// page cannot pass client state; PreferencesManager injects the real props via
// cloneElement at runtime. Defaults only guard the bare-render path.
type ApplyBarProps = {
  status?: Status;
  errorText?: string;
  onApply?: () => void;
  onDiscard?: () => void;
};

export default function ApplyBar({
  status = "idle",
  errorText,
  onApply,
  onDiscard,
}: ApplyBarProps) {
  const isSaving = status === "saving";
  const isSaved = status === "saved";

  return (
    <div className="flex items-center justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
        <span className="material-symbols-outlined text-tertiary text-[18px]">cloud_off</span>
        <span>Changes save to your workspace.</span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-space-sm">
          <button
            className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors"
            type="button"
            onClick={onDiscard}
          >
            Discard
          </button>
          <Button
            variant="primary"
            disabled={isSaving || isSaved}
            loading={isSaving}
            onClick={onApply}
          >
            {isSaving ? "Saving…" : "Apply Preferences"}
            {isSaved ? (
              <span className="inline-flex items-center gap-1">✓ Saved</span>
            ) : null}
          </Button>
        </div>
        {status === "error" ? (
          <p className="font-body-sm text-body-sm text-error">{errorText}</p>
        ) : null}
      </div>
    </div>
  );
}
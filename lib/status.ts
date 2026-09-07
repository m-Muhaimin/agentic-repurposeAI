// Shared source status vocabulary. The dashboard, library, and the
// editor page each used their own copy — this is the single source.
export const STATUS_LABEL: Record<string, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing…",
  transcribed: "Transcribed",
  generating: "Writing drafts…",
  done: "Ready",
  failed: "Failed"
};

export const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-neutral-100 text-neutral-700",
  transcribing: "bg-primary-100 text-primary-500",
  transcribed: "bg-primary-100 text-primary-500",
  generating: "bg-primary-100 text-primary-500",
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600"
};

// Agent run statuses reuse the same badge grammar as source statuses.
export const AGENT_STATUS_LABEL: Record<string, string> = {
  created: "Created",
  planning: "Planning…",
  awaiting_approval: "Awaiting approval",
  executing: "Generating…",
  evaluating: "Rating drafts…",
  done: "Ready",
  failed: "Failed",
  cancelled: "Cancelled"
};

export const AGENT_STATUS_STYLE: Record<string, string> = {
  created: "bg-neutral-100 text-neutral-700",
  planning: "bg-primary-100 text-primary-500",
  awaiting_approval: "bg-amber-100 text-amber-700",
  executing: "bg-primary-100 text-primary-500",
  evaluating: "bg-primary-100 text-primary-500",
  done: "bg-neutral-900 text-white",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-neutral-100 text-neutral-500"
};

export const PENDING_STATUS = ["uploaded", "transcribing", "transcribed", "generating"];

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusStyle(status: string): string {
  return STATUS_STYLE[status] ?? "bg-neutral-100 text-neutral-700";
}
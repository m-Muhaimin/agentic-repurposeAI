// Ingestion failure semantics (pure).
//
// A failed ingest surfaces as the Phase-1 lifecycle `failed` stage with a human
// `failReason` — what happened, why, and the next step. Providers throw
// IngestionFailure; the worker already lands `sources.status = 'failed'` and
// persists the message. This module guarantees a raw stack or internal noise
// never leaks into that user-facing reason: unknown errors are classified and
// truncated instead of passed through.

export interface IngestionFailureOptions {
  // What went wrong (concise, user-facing, actionable).
  reason: string;
  // Why it went wrong — extra context, still human.
  why?: string;
  // What the user/engineer can do next.
  nextStep?: string;
  // Short internal detail; explicitly NOT a stack trace. Used for logs only.
  underlying?: string;
}

// The failed stage the Phase-1 lifecycle vocabulary defines (lifecycle.ts).
export const FAILED_STAGE = "failed" as const;

export class IngestionFailure extends Error {
  readonly stage: typeof FAILED_STAGE;
  readonly why: string | null;
  readonly nextStep: string | null;
  readonly underlying: string | null;

  constructor(opts: IngestionFailureOptions) {
    super(buildFailReason(opts.reason, opts.why, opts.nextStep));
    this.name = "IngestionFailure";
    this.stage = "failed";
    this.why = opts.why ?? null;
    this.nextStep = opts.nextStep ?? null;
    this.underlying = opts.underlying ?? null;
  }
}

export function ingestionFailure(
  reason: string,
  opts: Omit<IngestionFailureOptions, "reason"> = {}
): IngestionFailure {
  return new IngestionFailure({ reason, ...opts });
}

export function isIngestionFailure(err: unknown): err is IngestionFailure {
  return err instanceof IngestionFailure;
}

// Compose the human failReason: "what happened. why. next step." Each clause is
// optional so failures can be terse without losing the shape.
export function buildFailReason(what: string, why?: string, nextStep?: string): string {
  const parts = [what.trim(), why?.trim(), nextStep?.trim()].filter((p): p is string => Boolean(p));
  return parts.join(" ") + (parts.length > 0 ? "" : "Something went wrong.");
}

// Normalize any thrown thing into a user-facing reason. Never includes a stack
// trace; unknown errors are classified rather than echoed raw.
export function toFailReason(err: unknown): string {
  if (isIngestionFailure(err)) return err.message;
  if (err instanceof Error) return truncate(err.message, 300) || "An unexpected error occurred.";
  if (typeof err === "string") return truncate(err, 300);
  return "An unexpected error occurred.";
}

export function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trimEnd()}…`;
}
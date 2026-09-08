// VervAI Orchestrator v1 — retry policy.
//
// Wraps the existing lib/agent/errors.ts classification with an explicit
// per-step retry budget and an exponential-backoff schedule. The decision
// "transient vs permanent" is delegated to the shared classifier (isTransientError)
// so the orchestration layer and the generation layer always agree. A step
// never retries past its max attempts, and permanent errors fail fast.
//
// PURE.

import { isTransientError, MAX_PHASE_ATTEMPTS } from "@/lib/agent/errors";

export const DEFAULT_MAX_ATTEMPTS = MAX_PHASE_ATTEMPTS;

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number; // 0..1 fraction of the delay to jitter
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  jitterRatio: 0.2
};

export type RetryDecision =
  | { action: "fail"; reason: string }
  | { action: "retry"; attempt: number; delayMs: number };

/**
 * Decide whether a failed step (attempt 1-based) should retry.
 *  - permanent errors always fail;
 *  - transient errors retry until the budget is exhausted, then fail.
 */
export function decideRetry(
  err: unknown,
  attempt: number, // 1-based; how many times this step has already run
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random = Math.random
): RetryDecision {
  if (!isTransientError(err)) {
    return { action: "fail", reason: "permanent error" };
  }
  if ((attempt - 1) >= policy.maxAttempts) {
    return { action: "fail", reason: `exhausted ${policy.maxAttempts} transient retries` };
  }
  return {
    action: "retry",
    attempt: attempt + 1,
    delayMs: backoff(attempt, policy, random)
  };
}

/**
 * Exponential backoff with a cap and optional jitter. Pure and deterministic
 * when given a fixed `random` (tests pass random = () => 0.5).
 */
export function backoff(
  attempt: number, // 1-based, the attempt that just failed
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random
): number {
  const exp = Math.min(
    policy.baseDelayMs * Math.pow(2, attempt - 1),
    policy.maxDelayMs
  );
  const span = exp * policy.jitterRatio;
  return Math.round(exp - span + random() * span * 2);
}

export function maxRetries(policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  return policy.maxAttempts;
}

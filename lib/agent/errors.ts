// P2 error classification for the agent orchestrator. A failed step must
// decide whether the run is worth a retry (transient: provider quota/network/
// 5xx) or should fail fast (permanent: validation, missing schema, missing
// table, forbidden, NotImplemented stubs). Mirrors the base app's retry.ts
// judgement so the agent layer and the generation layer agree on what's a
// transient overload vs a real problem.

export type ErrorClass = "transient" | "permanent";

export function isTransientError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // dropped connection / fetch aborted
  const message = err instanceof Error ? err.message : String(err);
  // HTTP-flavoured overload states (Gemini SDK + fetch errors).
  if (/429|503|quota|rate\s*limit|resource_exhausted|overload/i.test(message)) return true;
  if (/fetch failed|socket hang up|econnreset|etimedout|timeout|timed out|temporarily unavailable|service unavailable|try again later|name resolution|eai_again|enetdown|network/i.test(message)) return true;
  // PostgREST transient failures are rare but real (pool exhaustion, retryable
  // connect). We still classify selective, never the schema/RLS families.
  if (/PGRST116|connection refused|concurrency|transaction.*abort/i.test(message)) return false;
  return false;
}

export function classifyError(err: unknown): ErrorClass {
  return isTransientError(err) ? "transient" : "permanent";
}

// Short canonical label for the step row / UI. Keeps raw provider text out of
// the evidence trail and the user face.
export function describeError(err: unknown): string {
  if (isTransientError(err)) return "Transient provider or network error — retrying can continue the run.";
  const message = err instanceof Error ? err.message : String(err);
  return message.length > 0 ? message : "Run failed.";
}

export const MAX_PHASE_ATTEMPTS = 4;
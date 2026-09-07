// Gemini's free-tier endpoint is flaky under load: it frequently answers
// 503 "high demand", 429 rate-limit/quota, or drops the connection entirely.
// A single transient response should not fail the whole processing job, so
// wrap generates with a backoff retry. Retrying a generateContent call is
// safe — the failed attempt had no side effects.

const MAX_ATTEMPTS = 8;
// Cap the total time spent retrying so a job stays well inside the worker's
// 10-minute stale window even in the worst case.
const MAX_TOTAL_RETRY_MS = 90_000;

type FetchError = { status?: number; message?: unknown; errorDetails?: Array<{ retryDelay?: string }> };

// Google includes `RetryInfo.retryDelay` (e.g. "27s") on quota-limit errors;
// honor it instead of guessing a fixed backoff.
function serverRetryMs(err: FetchError): number | null {
  for (const detail of err.errorDetails ?? []) {
    const m = typeof detail?.retryDelay === "string" ? detail.retryDelay.match(/^(\d+(?:\.\d+)?)s$/) : null;
    if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  }
  return null;
}

function isRetryable(err: unknown): err is FetchError {
  if (err instanceof TypeError) return true; // dropped connection — wait and retry
  const e = err as FetchError;
  if (e.status === 503 || e.status === 429) return true;
  // The SDK wraps some network failures (undici aborts, timeouts, socket
  // resets) into its fetch error with no HTTP status. Treat those as flaky.
  if (!e.status && /fetch failed|socket hang up|econnreset|etimedout|network/i.test(String(e.message ?? ""))) {
    return true;
  }
  return false;
}

export async function retryOnOverload<T>(fn: () => Promise<T>): Promise<T> {
  let retriedMs = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS) throw err;
      const backoff = serverRetryMs(err) ?? 1500 * 2 ** attempt + Math.random() * 1000;
      if (retriedMs + backoff > MAX_TOTAL_RETRY_MS) throw err;
      retriedMs += backoff;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error("Exhausted retries"); // unreachable: loop returns or throws
}
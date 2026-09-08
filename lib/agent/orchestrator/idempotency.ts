// VervAI Orchestrator v1 — idempotency.
//
// Same (run, objective, output) must never produce duplicate work. v1 derives a
// stable key from the user + objective + source ids + output id. The durable
// worker persists the key on the step row (existing v4_agent_steps) and a
// partial-unique index enforces the row-level guarantee; this module only
// derives and validates the key with a seam so it's unit-testable.
//
// Mirrors the ingestion idempotency approach (lib/ingestion/idempotency.ts)
// where the raw-key derivation is pure and the enforcement lives in the schema.

export interface IdempotencyStoreSeam {
  stepExistsByKey?(key: string): Promise<boolean>;
  persistKey?(runId: string, stepId: string, key: string): Promise<void>;
}

export function stableKey(opts: {
  userId: string;
  runId: string;
  objective: string;
  sourceIds: readonly string[];
  outputId: string;
}): string {
  const sources = [...opts.sourceIds].sort().join("|");
  return `run:${opts.runId}:out:${opts.outputId}:obj:${opts.objective}:src:${sources}:u:${opts.userId}`;
}

/**
 * True when the given step should be treated as already having run for this
 * key. When no store seam is present we conservatively say "not seen" (the
 * caller dedupes via the schema instead).
 */
export async function alreadyRan(
  seam: IdempotencyStoreSeam | undefined,
  key: string
): Promise<boolean> {
  if (!seam?.stepExistsByKey) return false;
  return seam.stepExistsByKey(key);
}

// Fire-and-forget key write-back: never fails the step the way a bookkeeping
// hiccup could.
export async function persistKeySafely(
  seam: IdempotencyStoreSeam | undefined,
  runId: string,
  stepId: string,
  key: string
): Promise<void> {
  if (!seam?.persistKey) return;
  try {
    await seam.persistKey(runId, stepId, key);
  } catch {
    // Idempotency bookkeeping must never fail execution.
  }
}

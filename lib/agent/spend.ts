// P9: Agent spend computation — pure functions, no I/O.
//
// Converts real provider-observed token counts into estimated cost using
// published per-token rates. Every number surfaced to the user carries an
// honest label: "actual" when the token counts are real (planner usageMetadata,
// generation usage metadata), "estimated" when derived from published rates
// rather than the provider's own internal cost API.
//
// Gemini pricing (gemini-3.6-flash):  $0.075 / 1k input, $0.30 / 1k output
// OpenRouter fallback (llama-3.3-70b): $0.10  / 1k input, $0.10 / 1k output
// (rates from public documentation; the app has no access to provider-internal
// cost data — these are the best honest estimates available).

export type SpendSource = "actual" | "estimated";

// ── Per-provider token-to-cost conversion (deterministic, pure) ──────────

interface ProviderRates {
  // Cost per 1,000 tokens (published rates — no hidden decimals).
  inputPerK: number;
  outputPerK: number;
}

const PROVIDER_RATES: Record<string, ProviderRates> = {
  gemini: { inputPerK: 0.075, outputPerK: 0.30 },
  openrouter: { inputPerK: 0.10, outputPerK: 0.10 }
};

export type AgentProvider = "gemini" | "openrouter";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Convert real token counts into an estimated dollar cost using published rates.
// This is ESTIMATED because published rates ≠ the provider's internal cost, but
// the token counts themselves are real (observed from the provider's response).
export function tokenCost(tokens: TokenUsage, provider: AgentProvider): number {
  const rates = PROVIDER_RATES[provider] ?? PROVIDER_RATES.gemini;
  const inputCost = (tokens.inputTokens / 1000) * rates.inputPerK;
  const outputCost = (tokens.outputTokens / 1000) * rates.outputPerK;
  // Round to 6dp for precision without false claims.
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

// Convert total tokens (input + output) into the existing cost_units metric
// that the budget system enforces. Preserves the existing planning formula
// exactly:
//   cost_units = Math.round((inputTokens + outputTokens) / 100) / 100
//   ✓ 1500 tokens → 0.15
// so all existing budget guards stay valid.
export function tokensToCostUnits(inputTokens: number, outputTokens: number): number {
  return Math.round((inputTokens + outputTokens) / 100) / 100;
}

// ── Per-step spend event (recorded into step output jsonb) ───────────────

export interface SpendEvent {
  provider: AgentProvider;
  inputTokens: number;
  outputTokens: number;
  costUnits: number;
  source: SpendSource; // "actual" when real usageMetadata, "estimated" when derived
}

// Build a spend event from real token counts (planner usageMetadata or
// generation usage metadata). The cost_units value preserves the existing
// formula so budget enforcement is unchanged.
export function buildSpendEvent(
  tokens: TokenUsage,
  provider: AgentProvider,
  source: SpendSource = "actual"
): SpendEvent {
  return {
    provider,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    costUnits: tokensToCostUnits(tokens.inputTokens, tokens.outputTokens),
    source
  };
}

// ── Per-step summary for the run detail UI ───────────────────────────────

export interface StepSpend {
  stepId: string;
  kind: string;
  label: string | null;
  inputTokens: number;
  outputTokens: number;
  costUnits: number;
  source: SpendSource;
}

// Extract spend data from a step row's output jsonb (if present).
// Steps recorded by the orchestrator include `spend` in their output.
export function stepSpendFromOutput(
  stepId: string,
  kind: string,
  label: string | null,
  output: unknown
): StepSpend | null {
  if (!output || typeof output !== "object") return null;
  const obj = output as Record<string, unknown>;
  const spend = obj.spend;
  if (!spend || typeof spend !== "object") return null;
  const s = spend as Record<string, unknown>;
  if (typeof s.inputTokens !== "number" || typeof s.outputTokens !== "number") return null;
  return {
    stepId,
    kind,
    label,
    inputTokens: s.inputTokens as number,
    outputTokens: s.outputTokens as number,
    costUnits: typeof s.costUnits === "number" ? (s.costUnits as number) : tokensToCostUnits(s.inputTokens as number, s.outputTokens as number),
    source: (s.source as SpendSource) ?? "actual"
  };
}

// ── Run-level aggregation ────────────────────────────────────────────────

export interface RunSpendSummary {
  // The run's snapshotted token counters (from orchestrator — real when
  // available, 0 when the step didn't report usage).
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUnits: number; // the existing budget metric (preserved exactly)
  // Estimated dollar cost (published-rate derived — never claimed as real $).
  estimatedCostUsd: number;
  // Whether we have at least one real token count to work from.
  hasActualTokens: boolean;
  // Per-step breakdown (cheapest-first by default for the UI).
  steps: StepSpend[];
  // Budget context.
  budgetMaxCostUnits: number;
  budgetPercentUsed: number; // 0..100
}

export function aggregateRunSpend(
  inputTokens: number,
  outputTokens: number,
  costUnits: number,
  maxCostUnits: number,
  steps: StepSpend[]
): RunSpendSummary {
  const hasActualTokens = inputTokens > 0 || outputTokens > 0;
  // Use a default provider (gemini) for the aggregate estimate. If some steps
  // used openrouter, the per-step breakdown is more accurate.
  const estimatedCostUsd = hasActualTokens
    ? tokenCost({ inputTokens, outputTokens }, "gemini")
    : 0;
  const budgetPercentUsed = maxCostUnits > 0
    ? Math.min(100, Math.round((costUnits / maxCostUnits) * 100))
    : 0;

  return {
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalCostUnits: costUnits,
    estimatedCostUsd,
    hasActualTokens,
    steps,
    budgetMaxCostUnits: maxCostUnits,
    budgetPercentUsed
  };
}

// ── Monthly spend from usage_events (plan-level) ────────────────────────

export interface MonthlySpend {
  jobsUsed: number;
  jobsLimit: number | null;
  jobsRemaining: number | null;
  agentRunsThisMonth: number;
  estimatedAgentCostUsd: number; // sum of per-run estimates
  atLimit: boolean;
}

// ── Monthly spend from agent runs (queried server-side) ──────────────────

export interface MonthlyAgentSpend {
  runsThisMonth: number;
  completedRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUnits: number;
  estimatedCostUsd: number;
}

// Aggregate spend across all of a user's agent runs in the current UTC month.
// Called server-side with service-role rows — never trust client-supplied data.
export function aggregateMonthlySpend(
  runs: Array<{
    input_tokens: number;
    output_tokens: number;
    cost_units: number;
    status: string;
  }>
): MonthlyAgentSpend {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUnits = 0;
  let completedRuns = 0;

  for (const r of runs) {
    totalInputTokens += r.input_tokens ?? 0;
    totalOutputTokens += r.output_tokens ?? 0;
    totalCostUnits += r.cost_units ?? 0;
    if (r.status === "done") completedRuns += 1;
  }

  return {
    runsThisMonth: runs.length,
    completedRuns,
    totalInputTokens,
    totalOutputTokens,
    totalCostUnits,
    estimatedCostUsd: tokenCost({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, "gemini")
  };
}

// ── Label helpers ────────────────────────────────────────────────────────

// Human-readable label for a spend data point. Returns "actual" when the
// underlying token counts are real, "estimated" when they're derived.
export function spendSourceLabel(source: SpendSource): string {
  return source === "actual" ? "actual" : "estimated";
}

// Format a dollar amount for display. Never claims precision beyond cents.
export function formatCostUsd(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents < 0.01) return "<$0.01";
  return `$${cents.toFixed(2)}`;
}

// Format a cost_units number for display (budget metric — not dollars).
export function formatCostUnits(units: number): string {
  if (units === 0) return "0";
  if (units < 1) return units.toFixed(2);
  if (units < 100) return units.toFixed(1);
  return Math.round(units).toString();
}

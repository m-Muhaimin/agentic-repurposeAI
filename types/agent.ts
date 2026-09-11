// Domain types for the Agentic VervAI loop. These are the source of truth
// for the stage machines (planning → approval → execution → evaluation), the
// tool registry, and the durable V4_* tables. Pure type module — no imports —
// so both server code and client components can read them.

// ── Autonomy modes (fixed capability sets, see lib/agent/permissions.ts) ────
export type AgentMode = "assist" | "execute" | "automate";

export const AGENT_MODES: readonly AgentMode[] = ["assist", "execute", "automate"];

// User-facing names for the autonomy axis. Everything below MUST stay internal:
// the enum values ("assist"/"execute"/"automate") never appear in user copy —
// UI maps them through this table (composer, run history, scale panel).
export const AGENT_MODE_LABEL: Record<AgentMode, string> = {
  assist: "Guide me",
  execute: "Do it with my approval",
  automate: "Run automatically"
};

// ── Content Plan (the planner's single structured output) ──────────────────
export interface ContentIdea {
  title: string;
  description: string;
  suggestedFormats: OutputFormat[];
  quotes: string[];
  rationale: string;
}

export interface ContentPlan {
  summary: string;
  angles: ContentIdea[];
}

// ── Evaluation rubric (deterministic — no LLM judge in V1) ─────────────────
export type ReviewFlag = "length" | "grounding" | "format_shape" | "ok";

export interface EvaluationResult {
  score: number; // 0..1 weighted rubric score
  flags: ReviewFlag[]; // which checks failed
  weak: boolean; // true if any flag beyond thresholds (needs review)
  notes: string[];
}

// P3 idea-scoring result: an objective, deterministic rating of a *proposed
// angle* (before generation), persisted on v4_content_ideas.evaluation. This
// is deliberately distinct from EvaluationResult, which rates a *generated
// draft*. `weakness` is null when no dimension fell below the flag threshold.
export interface IdeaEvaluation {
  score: number; // 0..1 weighted, rounded to 2dp
  grounding: number; // traces to the transcript (0..1)
  distinctness: number; // differs from sibling angles (0..1)
  specificity: number; // concrete / hook-worthy title (0..1)
  flags: IdeaWeakness[];
  weakness: string | null;
  notes: string[];
}

export type IdeaWeakness = "grounding" | "distinctness" | "specificity";

// ── Step kinds in the run state machine ─────────────────────────────────────
export type AgentStepKind =
  | "planning"
  | "source"
  | "generation"
  | "review"
  | "distribution"
  | "strategy";

export const AGENT_STEP_KINDS: readonly AgentStepKind[] = [
  "planning",
  "source",
  "generation",
  "review",
  "distribution",
  "strategy"
];

// ── Run status (mirrors v4_agent_runs.status) ──────────────────────────────
export type RunStatus =
  | "created"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "evaluating"
  | "done"
  | "failed"
  | "cancelled";

export const RUN_LABEL: Record<RunStatus, string> = {
  created: "Created",
  planning: "Planning",
  awaiting_approval: "Awaiting approval",
  executing: "Generating",
  evaluating: "Evaluating",
  done: "Ready",
  failed: "Failed",
  cancelled: "Cancelled"
};

export const PENDING_RUN_STATUS: readonly RunStatus[] = [
  "created",
  "planning",
  "executing",
  "evaluating"
];

// ── Output formats reused from the base app ─────────────────────────────────
export type OutputFormat = "linkedin_post" | "newsletter" | "shortform_script" | "thread" | "carousel";

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  "linkedin_post",
  "newsletter",
  "shortform_script",
  "thread",
  "carousel"
];

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  shortform_script: "Short-form script",
  thread: "Thread",
  carousel: "Carousel"
};

// ── Agent step record (durable row shape) ───────────────────────────────────
export interface AgentStepRow {
  id: string;
  run_id: string;
  user_id: string;
  kind: AgentStepKind;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  label: string | null;
  input: unknown;
  output: unknown;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

// ── Run record (durable row shape) ──────────────────────────────────────────
export interface AgentRunRow {
  id: string;
  user_id: string;
  source_id: string;
  mode: AgentMode;
  status: RunStatus;
  plan: ContentPlan | null;
  transcript_snapshot: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_units: number;
  step_count: number;
  output_ids: string[];
  error_message: string | null;
  attempt: number;
  approval_decision: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  // P2 run budgets — snapshotted from the user's plan at creation (server-side
  // only, never client-supplied). Enforced by the orchestrator; a hit parks the
  // run with whatever completed work it already produced.
  max_steps: number;
  max_cost_units: number;
  max_runtime_s: number;
  // P2 heartbeat — touched by the worker between steps so a dead worker's run
  // can be re-claimed on heartbeat staleness instead of parking forever.
  heartbeat_at: string | null;
}

// Why a run stopped short of `done`. Null = normal completion.
export type StopReason = "steps" | "cost" | "runtime" | "cancelled" | null;

// Lightweight list row returned by GET /api/agent/runs (has the joined title).
export interface AgentRunSummary {
  id: string;
  source_id: string;
  sourceTitle: string;
  mode: AgentMode;
  status: RunStatus;
  plan: ContentPlan | null;
  step_count: number;
  output_ids: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

// ── Tool registry entry ─────────────────────────────────────────────────────
export type ToolContext = {
  userId: string;
  runId: string;
  mode: AgentMode;
};

export type ToolResult = {
  ok: boolean;
  // Structured output persisted in the step row (and often the run).
  data: unknown;
  // Optional side-channel for the worker (e.g. drafts written to outputs).
  outputs?: Array<{ format: OutputFormat; content: string; outputId?: string }>;
  error?: string;
};

export interface AgentTool {
  name: string;
  kind: AgentStepKind;
  label: string;
  // Which capability (mode set) gates this tool.
  requires: AgentMode[];
  describe: () => string;
  run: (ctx: ToolContext, input: unknown) => Promise<ToolResult>;
}

// ── Brand voice / memory signals (Stage 2) ──────────────────────────────────
export interface BrandVoiceProfile {
  tone: string;
  forbiddenPhrases: string[];
  examples: string[];
}

// What kind of durable signal this is. `edit` = the user hand-edited a draft
// (edit feedback); `preference` = the user changed a brand/mode preference
// explicitly; `angle_decision` = the user kept/rejected an idea at the approval
// gate. All are stored append-only in v4_agent_preferences.edit_signals and
// surfaced (never auto-applied) through the confidence-gated confirm loop.
export type SignalKind = "edit" | "preference" | "angle_decision";

export interface EditSignal {
  kind: SignalKind;
  // The thing the signal is about: an output id (edit), a preference field
  // (preference), or an idea title (angle_decision).
  outputId: string;
  whatChanged: string; // tonal note, sentence-level hint
  at: string;
}

// ── Distribution (Stage 4 seed) ─────────────────────────────────────────────
export type DistributionPlatform =
  | "linkedin"
  | "x"
  | "newsletter"
  | "youtube_shorts"
  | "tiktok"
  | "instagram";

export interface DistributionRequest {
  platform: DistributionPlatform;
  outputId: string;
  scheduledAt?: string;
}

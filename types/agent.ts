// Domain types for the Agentic RepurposeAI loop. These are the source of truth
// for the stage machines (planning → approval → execution → evaluation), the
// tool registry, and the durable V4_* tables. Pure type module — no imports —
// so both server code and client components can read them.

// ── Autonomy modes (fixed capability sets, see lib/agent/permissions.ts) ────
export type AgentMode = "assist" | "execute" | "automate";

export const AGENT_MODES: readonly AgentMode[] = ["assist", "execute", "automate"];

export const AGENT_MODE_LABEL: Record<AgentMode, string> = {
  assist: "Assist",
  execute: "Execute",
  automate: "Automate"
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
export type OutputFormat = "linkedin_post" | "newsletter" | "shortform_script";

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  "linkedin_post",
  "newsletter",
  "shortform_script"
];

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  shortform_script: "Short-form script"
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
}

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

export interface EditSignal {
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

// Agent canvas graph model — the shared vocabulary between the orchestration
// layer (backend, authoritative) and the React Flow canvas (frontend, purely a
// visualisation). The graph is rebuilt from durable state on every read; React
// Flow never holds workflow truth.
//
// Rules this module enforces:
//  - Node types are PRODUCT operations (Understand, Find opportunities…), not
//    model internals. No chain-of-thought, no prompts, no raw tool calls.
//  - Node statuses are derived from real backend state (v4_agent_runs /
//    v4_agent_steps / v4_content_ideas / outputs / v4_distribution_jobs), never
//    fabricated or client-supplied.
//  - Node ids are the stable type id so the frontend can diff state across
//    polls without rekeying.

export type AgentNodeType =
  | "source"
  | "understand"
  | "intelligence"
  | "opportunity"
  | "recommendation"
  | "plan"
  | "approval"
  | "create"
  | "validate"
  | "review"
  | "publish";

export type AgentNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "awaiting_approval"
  | "failed"
  | "skipped"
  | "paused";

export const NODE_TYPES: readonly AgentNodeType[] = [
  "source",
  "understand",
  "intelligence",
  "opportunity",
  "recommendation",
  "plan",
  "approval",
  "create",
  "validate",
  "review",
  "publish"
];

export const NODE_LABEL: Record<AgentNodeType, string> = {
  source: "Source",
  understand: "Understand",
  intelligence: "Intelligence",
  opportunity: "Opportunities",
  recommendation: "Recommendations",
  plan: "Plan",
  approval: "Approval",
  create: "Create",
  validate: "Validate",
  review: "Review",
  publish: "Publish"
};

export interface AgentNode {
  // Stable across polls for the same run: the node type id.
  id: string;
  type: AgentNodeType;
  status: AgentNodeStatus;
  title: string;
  description?: string;
  // Safe counts (opportunity count, draft count, …). Scalars only.
  count?: number;
  evidenceCount?: number;
  formatIds?: string[];
  artifactIds?: string[];
  meta?: Record<string, unknown>;
}

export interface AgentEdge {
  id: string;
  source: AgentNodeType;
  target: AgentNodeType;
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
  runId: string | null;
  runStatus: string | null;
}

// Minimal structural shapes the builder reads from durable rows. Kept local so
// this module stays pure (no Supabase imports) and unit-testable.
export interface GraphSourceRow {
  id: string;
  title: string;
  source_type: string;
  status: string;
  duration_seconds: number | null;
}

export interface GraphRunRow {
  id: string;
  status: string;
  plan: { summary: string; angles: Array<{ title: string; suggestedFormats?: string[] }> } | null;
  approval_decision: string | null;
  output_ids: string[];
  error_message: string | null;
}

export interface GraphStepRow {
  kind: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  label: string | null;
}

export interface GraphIdeaRow {
  id: string;
  title: string;
  suggested_formats: string[];
  quotes: string[];
  approved: boolean;
}

export interface GraphOutputRow {
  id: string;
  format: string;
  content: string;
}

export interface GraphDistributionJobRow {
  id: string;
  platform: string;
  status: string;
  error_message: string | null;
}

export interface GraphIntelligenceSummary {
  topics: number;
  claims: number;
  quotes: number;
  insights: number;
  opportunities: number;
}

export interface AgentGraphInput {
  source: GraphSourceRow | null;
  run: GraphRunRow | null;
  ideas: GraphIdeaRow[];
  steps: GraphStepRow[];
  outputs: GraphOutputRow[];
  distributionJobs: GraphDistributionJobRow[];
  intelligence?: GraphIntelligenceSummary | null;
  // Registry-driven labels. Injected so tests can prove the builder is
  // compatible with output formats added to the Output Registry later.
  formatLabels?: Record<string, string>;
}
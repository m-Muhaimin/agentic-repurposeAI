// Builds the authoritative workflow graph for one agent run from durable
// backend state. Pure function — the route feeds it fetched rows, tests feed it
// fixtures. The mapping below is deterministic: every node state is derived
// from a real signal (run status, step rows, content ideas, plan, outputs,
// distribution jobs, content-intelligence counts) and only falls back to
// run-status inference when no finer-grained signal exists.

import { FORMAT_LABEL } from "@/types/agent";
import type {
  AgentGraph,
  AgentGraphInput,
  AgentNode,
  AgentNodeStatus,
  AgentNodeType,
  GraphStepRow
} from "./types";
import { NODE_LABEL, NODE_TYPES, type AgentEdge } from "./types";

// Canonical workflow order — the graph is a straight pipeline.
const EDGE_PIPELINE: Array<[AgentNodeType, AgentNodeType]> = [
  ["source", "understand"],
  ["understand", "intelligence"],
  ["intelligence", "opportunity"],
  ["opportunity", "recommendation"],
  ["recommendation", "plan"],
  ["plan", "approval"],
  ["approval", "create"],
  ["create", "validate"],
  ["validate", "review"],
  ["review", "publish"]
];

function stepStatus(s: GraphStepRow | undefined): AgentNodeStatus | null {
  if (!s) return null;
  switch (s.status) {
    case "pending":
      return "queued";
    case "running":
      return "running";
    case "done":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
  }
}

// Highest workflow index the run has entered, from the run status alone.
function runStage(status: string | null | undefined): number {
  switch (status) {
    case "created":
      return 0;
    case "planning":
      return 5; // through Plan
    case "awaiting_approval":
      return 6; // Approval is the active gate
    case "executing":
      return 7; // Create
    case "evaluating":
      return 8; // Validate
    case "done":
      return 10; // through Review; Publish is never auto-entered
    case "failed":
      return 10; // walked backwards by the failed-node pass below
    case "cancelled":
      return 6; // stopped at the approval gate
    default:
      return 0;
  }
}

function formatLabel(format: string, labels: Record<string, string>): string {
  return labels[format] ?? format;
}

export function buildAgentGraph(input: AgentGraphInput): AgentGraph {
  const { source, run, ideas, steps, outputs, distributionJobs, intelligence } = input;
  const labels: Record<string, string> = { ...FORMAT_LABEL, ...(input.formatLabels ?? {}) };

  const nodes: AgentNode[] = [];
  const activeStage = runStage(run?.status);
  const runFailed = run?.status === "failed";
  const runCancelled = run?.status === "cancelled";

  const stepFor = (kind: string) => steps.find((s) => s.kind === kind);
  const sourceStep = stepFor("source");
  const planningStep = stepFor("planning");
  const generationStep = stepFor("generation");
  const reviewStep = stepFor("review");

  const ideaIds = ideas.map((i) => i.id);
  const ideaFormats = [...new Set(ideas.flatMap((i) => i.suggested_formats))];
  const planFormats = [...new Set((run?.plan?.angles ?? []).flatMap((a) => a.suggestedFormats ?? []))];
  const outputIds = outputs.map((o) => o.id);
  const outputFormats = [...new Set(outputs.map((o) => o.format))];

  // ── Source ────────────────────────────────────────────────────────────────
  const sourceNode: AgentNode = {
    id: "source",
    type: "source",
    status: source
      ? source.status === "done"
        ? "completed"
        : source.status === "failed"
          ? "failed"
          : "running"
      : run
        ? "completed"
        : "idle",
    title: NODE_LABEL.source,
    description: source?.title ?? undefined,
    meta: source
      ? { type: source.source_type, durationSeconds: source.duration_seconds }
      : undefined,
    artifactIds: source ? [source.id] : []
  };
  nodes.push(sourceNode);

  // ── Understand ────────────────────────────────────────────────────────────
  const understandStep = stepStatus(sourceStep);
  const understandStatus =
    understandStep ??
    (source?.status === "done"
      ? "completed"
      : source && source.status !== "failed"
        ? "running"
        : run
          ? activeStage >= 1
            ? "completed"
            : "queued"
          : "idle");
  nodes.push({
    id: "understand",
    type: "understand",
    status: understandStatus,
    title: NODE_LABEL.understand,
    description:
      "VervAI reads the source so it can work from what you actually said or wrote.",
    count: source?.duration_seconds != null ? 1 : undefined,
    meta: sourceStep?.label ? { step: sourceStep.label } : undefined,
    artifactIds: source?.id ? [source.id] : []
  });

  // ── Intelligence ──────────────────────────────────────────────────────────
  const intelligencePresent = intelligence != null && (intelligence.topics + intelligence.claims + intelligence.quotes) > 0;
  const planningStatus = stepStatus(planningStep);
  const intelligenceStatus: AgentNodeStatus = intelligencePresent
    ? "completed"
    : planningStatus ??
      (run?.plan
        ? "completed"
        : run
          ? activeStage >= 2
            ? "completed"
            : runFailed
              ? "failed"
              : "queued"
          : "idle");
  nodes.push({
    id: "intelligence",
    type: "intelligence",
    status: intelligenceStatus,
    title: NODE_LABEL.intelligence,
    description:
      "Durable analysis of the source — topics, claims, quotes and insights that ground everything that follows.",
    count: intelligence ? intelligence.topics + intelligence.claims + intelligence.insights : undefined,
    evidenceCount: intelligence?.quotes,
    artifactIds: source?.id ? [source.id] : []
  });

  // ── Opportunities ─────────────────────────────────────────────────────────
  const opportunityStatus: AgentNodeStatus =
    ideas.length > 0
      ? "completed"
      : planningStatus === "running"
        ? "running"
        : run
          ? activeStage >= 3
            ? "completed"
            : runFailed
              ? "failed"
              : "queued"
          : "idle";
  nodes.push({
    id: "opportunity",
    type: "opportunity",
    status: opportunityStatus,
    title: NODE_LABEL.opportunity,
    description: "Distinct angles the source could become.",
    count: ideas.length > 0 ? ideas.length : undefined,
    evidenceCount: ideas.reduce((n, i) => n + i.quotes.length, 0) || undefined,
    formatIds: ideaFormats.length > 0 ? ideaFormats : undefined,
    artifactIds: ideaIds
  });

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendationStatus: AgentNodeStatus = run?.plan
    ? "completed"
    : planningStatus === "running"
      ? "running"
      : run
        ? activeStage >= 4
          ? "completed"
          : runFailed
            ? "failed"
            : "queued"
        : "idle";
  nodes.push({
    id: "recommendation",
    type: "recommendation",
    status: recommendationStatus,
    title: NODE_LABEL.recommendation,
    description:
      "Which formats fit this source best, driven by the Output Registry.",
    count: planFormats.length > 0 ? planFormats.length : undefined,
    formatIds: planFormats.length > 0 ? planFormats : undefined,
    meta: run?.plan?.summary ? { summary: run.plan.summary } : undefined,
    artifactIds: ideaIds
  });

  // ── Plan ──────────────────────────────────────────────────────────────────
  const planStatus: AgentNodeStatus = run?.plan
    ? "completed"
    : run?.status === "planning"
      ? "running"
      : run
        ? activeStage >= 5
          ? "completed"
          : runFailed
            ? "failed"
            : "queued"
        : "idle";
  nodes.push({
    id: "plan",
    type: "plan",
    status: planStatus,
    title: NODE_LABEL.plan,
    description:
      run?.plan
        ? `${run.plan.angles.length} angle${run.plan.angles.length === 1 ? "" : "s"} recommended — ready for your call.`
        : "VervAI assembles what it intends to create for your approval.",
    count: run?.plan?.angles.length,
    formatIds: planFormats.length > 0 ? planFormats : undefined,
    artifactIds: ideaIds,
    meta: run?.plan?.summary ? { summary: run.plan.summary } : undefined
  });

  // ── Approval ──────────────────────────────────────────────────────────────
  const anyIdeaApproved = ideas.some((i) => i.approved);
  let approvalStatus: AgentNodeStatus;
  if (run?.status === "awaiting_approval") approvalStatus = "awaiting_approval";
  else if (run?.approval_decision === "rejected" || runCancelled) approvalStatus = "skipped";
  else if (anyIdeaApproved || run?.approval_decision === "approved") approvalStatus = "completed";
  else if (run && activeStage >= 6) approvalStatus = "queued";
  else approvalStatus = "idle";
  nodes.push({
    id: "approval",
    type: "approval",
    status: approvalStatus,
    title: NODE_LABEL.approval,
    description:
      run?.status === "awaiting_approval"
        ? "VervAI has a plan ready — approve it and creation begins."
        : "Human gate before anything is generated.",
    meta: run?.approval_decision ? { decision: run.approval_decision } : undefined,
    artifactIds: ideaIds
  });

  // ── Create ────────────────────────────────────────────────────────────────
  const createStatus: AgentNodeStatus =
    outputIds.length > 0
      ? "completed"
      : stepStatus(generationStep) ??
        (run?.status === "executing"
          ? "running"
          : run
            ? activeStage >= 7
              ? "queued"
              : "idle"
            : "idle");
  nodes.push({
    id: "create",
    type: "create",
    status: createStatus,
    title: NODE_LABEL.create,
    description: "Drafts written from the approved plan.",
    count: outputIds.length > 0 ? outputIds.length : undefined,
    formatIds: outputFormats.length > 0 ? outputFormats : undefined,
    artifactIds: outputIds
  });

  // ── Validate ──────────────────────────────────────────────────────────────
  const reviewStatus = stepStatus(reviewStep);
  const validateStatus: AgentNodeStatus =
    reviewStatus === "running" || run?.status === "evaluating"
      ? "running"
      : reviewStatus ?? (outputIds.length > 0 ? "completed" : run ? (activeStage >= 8 ? "queued" : "idle") : "idle");
  nodes.push({
    id: "validate",
    type: "validate",
    status: validateStatus,
    title: NODE_LABEL.validate,
    description: "Each draft is checked against length, format shape and grounding.",
    count: outputIds.length > 0 ? outputIds.length : undefined,
    artifactIds: outputIds
  });

  // ── Review ────────────────────────────────────────────────────────────────
  const reviewStatusOut: AgentNodeStatus =
    outputIds.length > 0 && (run?.status === "done" || run?.status === "evaluating")
      ? "completed"
      : run?.status === "evaluating"
        ? "running"
        : run
          ? activeStage >= 9
            ? "queued"
            : "idle"
          : "idle";
  nodes.push({
    id: "review",
    type: "review",
    status: reviewStatusOut,
    title: NODE_LABEL.review,
    description: "Your turn — open the editor to refine or approve a draft.",
    count: outputIds.length > 0 ? outputIds.length : undefined,
    formatIds: outputFormats.length > 0 ? outputFormats : undefined,
    artifactIds: outputIds
  });

  // ── Publish ───────────────────────────────────────────────────────────────
  const publishedJobs = distributionJobs.filter((j) => j.status === "published");
  const scheduledJobs = distributionJobs.filter((j) => j.status === "scheduled");
  const failedJobs = distributionJobs.filter((j) => j.status === "failed");
  let publishStatus: AgentNodeStatus = "idle";
  if (publishedJobs.length > 0) publishStatus = "completed";
  else if (failedJobs.length > 0) publishStatus = "failed";
  else if (scheduledJobs.length > 0) publishStatus = "queued";
  else if (distributionJobs.length > 0) publishStatus = "queued";
  nodes.push({
    id: "publish",
    type: "publish",
    status: publishStatus,
    title: NODE_LABEL.publish,
    description:
      distributionJobs.length > 0
        ? "Distribution is scheduled through your connected channels."
        : "Nothing is sent without your call — connect a channel and schedule from the publish queue.",
    count: distributionJobs.length > 0 ? distributionJobs.length : undefined,
    meta:
      distributionJobs.length > 0
        ? { scheduled: scheduledJobs.length, published: publishedJobs.length, failed: failedJobs.length }
        : undefined,
    artifactIds: distributionJobs.map((j) => j.id)
  });

  // ── Failure pass: a failed run with no finer-grained failed node ──────────
  if (runFailed && !nodes.some((n) => n.status === "failed")) {
    const reached = nodes.filter((n) => n.status === "completed" || n.status === "running" || n.status === "queued");
    const failedNode =
      [...nodes].reverse().find((n) => n.status === "running") ??
      reached[reached.length - 1] ??
      nodes[runStage("failed")];
    if (failedNode) failedNode.status = "failed";
    for (const node of nodes) {
      const idx = NODE_TYPES.indexOf(node.type);
      if (idx > NODE_TYPES.indexOf(failedNode.type)) node.status = "idle";
    }
  }

  // ── Cancelled pass: stop the graph at the approval gate ───────────────────
  if (runCancelled) {
    for (const node of nodes) {
      const idx = NODE_TYPES.indexOf(node.type);
      if (idx > NODE_TYPES.indexOf("approval")) node.status = "idle";
    }
  }

  const edges: AgentEdge[] = EDGE_PIPELINE.map(([sourceId, targetId]) => ({
    id: `${sourceId}:${targetId}`,
    source: sourceId,
    target: targetId
  })).filter((e) => {
    const present = (t: AgentNodeType) => nodes.some((n) => n.type === t && n.status !== "idle");
    return present(e.source) || present(e.target);
  });

  return {
    nodes,
    edges,
    runId: run?.id ?? null,
    runStatus: run?.status ?? null
  };
}
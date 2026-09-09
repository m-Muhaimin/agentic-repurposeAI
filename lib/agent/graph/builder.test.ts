import { describe, it, expect } from "vitest";
import { buildAgentGraph } from "./builder";
import type { AgentGraphInput, GraphSourceRow, GraphRunRow, GraphIdeaRow, GraphStepRow, GraphDistributionJobRow } from "./types";
import { NODE_TYPES } from "./types";

const source: GraphSourceRow = {
  id: "src-1",
  title: "My source",
  source_type: "audio",
  status: "done",
  duration_seconds: 600
};

const base: AgentGraphInput = {
  source,
  run: { id: "run-1", status: "created", plan: null, approval_decision: null, output_ids: [], error_message: null },
  ideas: [],
  steps: [],
  outputs: [],
  distributionJobs: [],
  intelligence: null
};

function graph(status: string, overrides: Partial<AgentGraphInput> = {}) {
  return buildAgentGraph({ ...base, run: { ...base.run!, status }, ...overrides });
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural
// ─────────────────────────────────────────────────────────────────────────────

describe("graph structure", () => {
  it("always emits all 11 node types in canonical order", () => {
    const g = graph("created");
    expect(g.nodes.map((n) => n.type)).toEqual(NODE_TYPES);
  });

  it("includes edges up to the active gate (idle→idle edges filtered)", () => {
    const g = graph("awaiting_approval");
    // source..approval are active; create..publish are idle — no idle→idle edges
    expect(g.edges.length).toBeGreaterThanOrEqual(7);
    expect(g.edges[g.edges.length - 1].source).toBe("approval");
  });

  it("includes all 10 edges when run is done", () => {
    const g = graph("done");
    expect(g.edges.length).toBe(10);
  });

  it("passes runId through", () => {
    const g = graph("done");
    expect(g.runId).toBe("run-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Node status mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("source node", () => {
  it("completed when source.status is done", () => {
    expect(graph("done").nodes[0].status).toBe("completed");
  });
  it("failed when source.status is failed", () => {
    const src = { ...source, status: "failed" };
    expect(buildAgentGraph({ ...base, source: src, run: null }).nodes[0].status).toBe("failed");
  });
  it("running when source.status is transcribing", () => {
    const src = { ...source, status: "transcribing" };
    expect(buildAgentGraph({ ...base, source: src, run: null }).nodes[0].status).toBe("running");
  });
  it("completed when run exists even if source not found (fallback)", () => {
    const g = buildAgentGraph({ ...base, source: null, run: { ...base.run!, status: "done" } });
    expect(g.nodes[0].status).toBe("completed");
  });
});

describe("approval node", () => {
  it("awaiting_approval when run.status is awaiting_approval", () => {
    const g = graph("awaiting_approval");
    expect(g.nodes.find((n) => n.type === "approval")!.status).toBe("awaiting_approval");
  });
  it("skipped when cancelled", () => {
    const g = graph("cancelled", { run: { id: "run-1", status: "cancelled", plan: null, approval_decision: "rejected", output_ids: [], error_message: null } });
    expect(g.nodes.find((n) => n.type === "approval")!.status).toBe("skipped");
  });
  it("completed when at least one idea is approved and run is executing", () => {
    const ideas: GraphIdeaRow[] = [{ id: "a1", title: "A", suggested_formats: ["linkedin_post"], quotes: [], approved: true }];
    const g = graph("executing", {
      ideas,
      run: { id: "run-1", status: "executing", plan: { summary: "", angles: [] }, approval_decision: "approved", output_ids: [], error_message: null }
    });
    expect(g.nodes.find((n) => n.type === "approval")!.status).toBe("completed");
  });
});

describe("create node", () => {
  it("completed when outputs exist", () => {
    const outputs = [{ id: "o1", format: "linkedin_post", content: "draft" }];
    const g = graph("done", { outputs });
    expect(g.nodes.find((n) => n.type === "create")!.status).toBe("completed");
  });
  it("running when generation step is running", () => {
    const steps: GraphStepRow[] = [{ kind: "generation", status: "running", label: null }];
    const g = graph("executing", { steps });
    expect(g.nodes.find((n) => n.type === "create")!.status).toBe("running");
  });
});

describe("review node", () => {
  it("completed when outputs exist and run is done", () => {
    const outputs = [{ id: "o1", format: "newsletter", content: "draft" }];
    const g = graph("done", { outputs });
    expect(g.nodes.find((n) => n.type === "review")!.status).toBe("completed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure and cancellation passes
// ─────────────────────────────────────────────────────────────────────────────

describe("failed run", () => {
  it("marks the last active node as failed and everything after idle", () => {
    const g = graph("failed", {
      run: { id: "run-1", status: "failed", plan: null, approval_decision: null, output_ids: [], error_message: "LLM error" },
      steps: []
    });
    const failedNode = g.nodes.find((n) => n.status === "failed");
    expect(failedNode).toBeDefined();
    expect(failedNode!.type).not.toBe("source"); // source was done
    const failedIdx = NODE_TYPES.indexOf(failedNode!.type);
    for (const n of g.nodes) {
      const idx = NODE_TYPES.indexOf(n.type);
      if (idx > failedIdx) expect(n.status).not.toBe("completed");
    }
  });
});

describe("cancelled run", () => {
  it("nodes after approval are idle", () => {
    const g = graph("cancelled");
    for (const n of g.nodes) {
      const idx = NODE_TYPES.indexOf(n.type);
      if (idx > NODE_TYPES.indexOf("approval")) {
        expect(["idle", "skipped"]).toContain(n.status);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Opportunity and recommendation nodes
// ─────────────────────────────────────────────────────────────────────────────

describe("opportunity node", () => {
  it("completed with count when ideas exist", () => {
    const ideas: GraphIdeaRow[] = [
      { id: "i1", title: "Hook", suggested_formats: ["newsletter"], quotes: ["q1"], approved: false },
      { id: "i2", title: "Deep dive", suggested_formats: ["linkedin_post"], quotes: [], approved: false }
    ];
    const g = graph("awaiting_approval", { ideas, run: { id: "r", status: "awaiting_approval", plan: { summary: "", angles: [] }, approval_decision: null, output_ids: [], error_message: null } });
    const n = g.nodes.find((n) => n.type === "opportunity")!;
    expect(n.status).toBe("completed");
    expect(n.count).toBe(2);
    expect(n.evidenceCount).toBe(1); // 1 quote total
  });
});

describe("dynamic format registry compatibility", () => {
  it("supports custom format ids passed via formatLabels", () => {
    const customLabels = { newsletter: "Newsletter", linkedin_post: "LinkedIn", custom_longform: "Long-form" };
    const ideas: GraphIdeaRow[] = [
      { id: "i1", title: "A", suggested_formats: ["custom_longform"], quotes: [], approved: false }
    ];
    const g = graph("awaiting_approval", {
      ideas,
      run: { id: "r", status: "awaiting_approval", plan: { summary: "", angles: [] }, approval_decision: null, output_ids: [], error_message: null },
      formatLabels: customLabels
    });
    const opp = g.nodes.find((n) => n.type === "opportunity")!;
    expect(opp.formatIds).toContain("custom_longform");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence node
// ─────────────────────────────────────────────────────────────────────────────

describe("intelligence node", () => {
  it("completed when intelligence counts are non-zero", () => {
    const g = graph("done", { intelligence: { topics: 5, claims: 3, quotes: 4, insights: 2, opportunities: 3 } });
    expect(g.nodes.find((n) => n.type === "intelligence")!.status).toBe("completed");
  });
  it("uses planning step status when no intelligence row", () => {
    const steps: GraphStepRow[] = [{ kind: "planning", status: "running", label: null }];
    const g = graph("planning", { steps });
    expect(g.nodes.find((n) => n.type === "intelligence")!.status).toBe("running");
  });
});
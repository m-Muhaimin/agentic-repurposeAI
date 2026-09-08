// Phase 6: GET /api/recommendations route tests.
// Guards the dashboard API boundary: auth, sourceId validation, objective
// defaulting, ownership, and — critically — that the content_intelligence
// query selects the real `intelligence` column (jsonb). Selecting a phantom
// `data` column made the endpoint 404 even for valid intelligence.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentIntelligence } from "@/lib/intelligence/types";
import { analyzeContent } from "@/lib/intelligence";

const TEXT = `We launched in 2019. The data clearly shows remote teams win. That's why we built our own async tooling.

Imagine never needing a meeting again. What if you shipped ten times faster? We did.

"Bigger teams are slower" is the thing most people get wrong. Even though the evidence points the other way.

After that, we hired six engineers. Then we discovered process was the bottleneck. So we stripped everything down.`;

const META = { sourceId: "src-1", sourceType: "youtube", title: "Launching Async First" };

type CI = { id: string; source_id: string; intelligence: unknown; user_id: string };

const state = {
  user: null as { id: string } | null,
  objectiveError: { code: "PGRST116" } as { code: string } | null,
  objective: null as { current_objective: string | null } | null,
  intelError: null as { code: string } | null,
  intel: null as CI | null,
  source: null as { id: string } | null,
  lastSelect: "" as string
};

const makeClient = () => ({
  auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
  from: (table: string) => ({
    select: (cols: string) => {
      if (table === "content_intelligence") state.lastSelect = cols;
      return {
        eq: (_col: string, _val: string) => ({
          eq: (_c2: string, _v2: string) => ({
            single: async () => {
              if (table === "sources") return { data: state.source, error: null };
              return { data: null, error: null };
            }
          }),
          single: async () => {
            if (table === "user_preferences") return { data: state.objective, error: state.objectiveError };
            if (table === "content_intelligence") return { data: state.intel, error: state.intelError };
            if (table === "sources") return { data: state.source, error: null };
            return { data: null, error: null };
          }
        })
      };
    }
  })
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: makeClient,
  createServiceClient: () => ({})
}));

const intelligence = () => analyzeContent(TEXT, META) as unknown as ContentIntelligence;

describe("GET /api/recommendations", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.objectiveError = { code: "PGRST116" };
    state.objective = null;
    state.intelError = null;
    state.intel = {
      id: "ci-1",
      source_id: "src-1",
      intelligence: intelligence(),
      user_id: "user-1"
    };
    state.source = null;
    state.lastSelect = "";
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations?sourceId=src-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when sourceId is missing", async () => {
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations"));
    expect(res.status).toBe(400);
  });

  it("queries the real jsonb `intelligence` column and returns ranked recommendations", async () => {
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations?sourceId=src-1"));
    expect(res.status).toBe(200);
    expect(state.lastSelect).toContain("intelligence");
    expect(state.lastSelect).not.toContain("data");
    const body = await res.json();
    expect(body.objective.kind).toBe("get_reach");
    expect(body.sourceId).toBe("src-1");
    expect(body.recommendations.length).toBeGreaterThan(0);
    for (let i = 1; i < body.recommendations.length; i++) {
      expect(body.recommendations[i - 1].score).toBeGreaterThanOrEqual(body.recommendations[i].score);
    }
  });

  it("applies a stored objective preference when present", async () => {
    state.objectiveError = null;
    state.objective = { current_objective: "grow_email" };
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations?sourceId=src-1"));
    const body = await res.json();
    expect(body.objective.kind).toBe("grow_email");
  });

  it("returns 404 when no intelligence exists for the source", async () => {
    state.intel = null;
    state.intelError = { code: "PGRST116" };
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations?sourceId=src-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when intelligence belongs to another user and the source is not owned", async () => {
    state.intel = { id: "ci-1", source_id: "src-1", intelligence: intelligence(), user_id: "user-2" };
    state.source = null;
    const { GET } = await import("@/app/api/recommendations/route");
    const res = await GET(new Request("http://localhost/api/recommendations?sourceId=src-1"));
    expect(res.status).toBe(404);
  });
});
// Stage 4 (BYOB): Tests for the real distribution tool — posts an approved
// draft to Buffer (GraphQL createPost mutation) and flips the job to
// published/failed. Never fabricates success: a missing connection / missing
// profile / Buffer rejection surfaces as ok:false + job `failed`.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Fluent fake of the service client (supabase-js style). Each table can be
// pre-programmed; un-programmed writes are recorded, reads return empty.
let behavior: Record<string, unknown> = {};
let calls: { table: string; verb: string; payload: unknown }[] = [];

function makeBuilder(service: { from: (t: string) => unknown }) {
  const algorithm = {
    table: "" as string,
    state: {} as Record<string, unknown>,
    eq(k: string, v: unknown) {
      this.state.lastFilter = `${k}=${String(v)}`;
      return this;
    },
    in(k: string, v: unknown[]) {
      this.state.lastFilter = `${k} in [${v.join(",")}]`;
      return this;
    },
    select() {
      return this;
    },
    limit() {
      return this;
    },
    order() {
      return this;
    },
    update(payload: unknown) {
      calls.push({ table: this.table, verb: "update", payload });
      this.state.lastUpdate = payload;
      return this;
    },
    insert(payload: unknown) {
      calls.push({ table: this.table, verb: "insert", payload });
      this.state.lastInsert = payload;
      return this;
    },
    maybeSingle() {
      const s = (behavior[this.table] as Record<string, unknown>) ?? {};
      return { data: s.data ?? null, error: s.error ?? null };
    }
  };
  return {
    from(table: string) {
      const fresh = { ...algorithm };
      fresh.table = table;
      return fresh;
    }
  };
}

const fakeService = {
  from: (t: string) => makeBuilder(fakeService).from(t)
};

const mockGetFreshToken = vi.fn();
vi.mock("@/lib/buffer/connections", () => ({
  getFreshAccessToken: (...args: unknown[]) => mockGetFreshToken(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => fakeService
}));

import { distributionTool } from "@/lib/agent/tools/distribution";
import { getFreshAccessToken } from "@/lib/buffer/connections";

// Buffer GraphQL is ONE endpoint (api.buffer.com): the mock dispatches on which
// operation the query body contains, and records per-op calls for assertions.
type GraphqlOp = "account" | "channels" | "createPost";
let graphqlCalls: { op: GraphqlOp; body: string }[] = [];

interface GraphqlRoute {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  data?: unknown;
  errors?: { message?: string }[];
}

function mockGraphql(routes: Partial<Record<GraphqlOp, GraphqlRoute>>) {
  graphqlCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = init?.body ? String(init.body) : "";
      const op: GraphqlOp = body.includes("createPost")
        ? "createPost"
        : body.includes("channels(") || body.includes("organizationId")
          ? "channels"
          : "account";
      graphqlCalls.push({ op, body });
      const route = routes[op] ?? { ok: true, data: {} };
      const payload = route.errors ? { errors: route.errors } : { data: route.data };
      return {
        ok: route.ok ?? true,
        status: route.status ?? (route.ok === false ? 400 : 200),
        headers: { get: (name: string) => route.headers?.[name] ?? null },
        json: async () => payload,
        text: async () => JSON.stringify(payload)
      } as Response;
    })
  );
}

function callsFor(op: GraphqlOp): { op: GraphqlOp; body: string }[] {
  return graphqlCalls.filter((c) => c.op === op);
}

// The mocked fetch body is `{"query":"..."}` — decode it so assertions match the
// actual GraphQL text (quotes inside are JSON-escaped in the raw body).
function queryText(op: GraphqlOp): string {
  const call = callsFor(op)[0];
  expect(call, `expected a ${op} operation to have been sent`).toBeDefined();
  return (JSON.parse(call!.body) as { query: string }).query;
}

const ACCOUNT_ORG = { account: { organizations: [{ id: "org-1" }] } };

beforeEach(() => {
  behavior = {};
  calls = [];
  graphqlCalls = [];
  mockGetFreshToken.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("distributionTool — real Buffer publish path (GraphQL)", () => {
  it("fails closed when the user has no Buffer connection", async () => {
    mockGetFreshToken.mockResolvedValue(null);
    const result = await distributionTool.run(
      { userId: "u1", runId: "run-1", mode: "execute" },
      { platform: "linkedin", outputId: "out-1" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("NO_BUFFER_CONNECTION");
    expect(calls.some((c) => c.table === "v4_distribution_jobs" && c.verb === "update")).toBe(false);
    expect(graphqlCalls).toEqual([]);
  });

  it("fails cleanly when the approved draft is missing", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    mockGraphql({ account: { data: ACCOUNT_ORG } });
    // outputs read returns nothing
    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "x", outputId: "out-missing" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Approved draft unavailable");
    // No network call was made — failed before touching Buffer.
    expect(graphqlCalls).toEqual([]);
  });

  it("posts to Buffer and marks the job published on success", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    // Approved draft exists for this user
    behavior["outputs"] = { data: { id: "out-1", content: "Approved draft for LinkedIn." } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: {
        data: {
          channels: [
            { id: "54a1", service: "linkedin", name: "muhai" },
            { id: "54b2", service: "twitter", name: "muhai" }
          ]
        }
      },
      createPost: { data: { createPost: { post: { id: "5f3" } } } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1" }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ updateId: "5f3", platform: "linkedin", scheduled: false });
    // Profile matched the linkedin channel, not twitter — one mutation, single channel.
    const creates = callsFor("createPost");
    expect(creates).toHaveLength(1);
    expect(queryText("createPost")).toContain('channelId: "54a1"');
    expect(queryText("createPost")).not.toContain('channelId: "54b2"');
    expect(queryText("createPost")).toContain("mode: shareNow");
    // Job flipped to published with external_id + published_at.
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.payload as { status?: string; external_id?: string }).status).toBe("published");
    expect((jobUpdate!.payload as { external_id?: string }).external_id).toBe("5f3");
    // No run → no fabrication of a timeline step.
    expect(calls.some((c) => c.table === "v4_agent_steps")).toBe(false);
  });

  it("writes a distribution step when the call is backed by a real run", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    behavior["v4_agent_runs"] = { data: { id: "run-1" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "tiktok", name: "muhai" }] } },
      createPost: { data: { createPost: { post: { id: "u9" } } } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "run-1", mode: "execute" },
      { platform: "tiktok", outputId: "out-1" }
    );

    expect(result.ok).toBe(true);
    const step = calls.find((c) => c.table === "v4_agent_steps" && c.verb === "insert");
    expect(step).toBeDefined();
    expect((step!.payload as { kind?: string; status?: string }).kind).toBe("distribution");
    expect((step!.payload as { status?: string }).status).toBe("done");
  });

  it("rejects newsletter honestly (no Buffer channel backs a newsletter)", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "linkedin", name: "work" }] } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "newsletter", outputId: "out-1" }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No connected Buffer profile");
    // No create-post mutation was attempted.
    expect(callsFor("createPost")).toEqual([]);
  });

  it("marks the job failed (with the real reason) when Buffer rejects the update", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "instagram", name: "muhai" }] } },
      createPost: { data: { createPost: { message: "media_missing" } } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "instagram", outputId: "out-1" }
    );

    expect(result.ok).toBe(false);
    // The typed MutationError message is surfaced verbatim.
    expect(result.error).toContain("media_missing");
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect((jobUpdate!.payload as { status?: string }).status).toBe("failed");
    expect(String((jobUpdate!.payload as { error_message?: string }).error_message)).toContain("media_missing");
  });

  it("never auto-retries on a rate limit — surfaces the retry window, job failed", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "youtube", name: "muhai" }] } },
      createPost: {
        ok: false,
        status: 429,
        headers: { "retry-after": "30" },
        data: { errors: [{ message: "RATE_LIMIT_EXCEEDED" }] }
      }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "run-1", mode: "execute" },
      { platform: "youtube_shorts", outputId: "out-1" }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Retry after 30s");
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect((jobUpdate!.payload as { status?: string }).status).toBe("failed");
    // Exactly one create attempt — no retry loop.
    expect(callsFor("createPost")).toHaveLength(1);
  });

  it("honours an explicit Buffer profile selection (no guessing)", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: {
        data: {
          channels: [
            { id: "p1", service: "linkedin", name: "work" },
            { id: "p2", service: "linkedin", name: "personal" }
          ]
        }
      },
      createPost: { data: { createPost: { post: { id: "u1" } } } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1", profileIds: ["p2"] }
    );

    expect(result.ok).toBe(true);
    expect((result.data as { profileIds?: string[] }).profileIds).toEqual(["p2"]);
    expect(callsFor("createPost")).toHaveLength(1);
    expect(queryText("createPost")).toContain('channelId: "p2"');
    expect(queryText("createPost")).not.toContain('channelId: "p1"');
  });

  it("rejects a requested profile that is not connected for the platform", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "linkedin", name: "work" }] } },
      createPost: { data: { createPost: { post: { id: "u1" } } } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1", profileIds: ["nope"] }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not connected");
    expect(callsFor("createPost")).toEqual([]);
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect((jobUpdate!.payload as { status?: string }).status).toBe("failed");
  });

  it("scheduled send stays `scheduled` with the Buffer post id — never fake-published", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockGraphql({
      account: { data: ACCOUNT_ORG },
      channels: { data: { channels: [{ id: "p1", service: "twitter", name: "muhai" }] } },
      createPost: { data: { createPost: { post: { id: "sched-9" } } } }
    });

    const when = "2026-09-08T09:00:00.000Z";
    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "x", outputId: "out-1", scheduledAt: when }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ scheduled: true, scheduledAt: when });
    expect(callsFor("createPost")).toHaveLength(1);
    // customScheduled mode carries the chosen dueAt, not shareNow.
    expect(queryText("createPost")).toContain("mode: customScheduled");
    expect(queryText("createPost")).toContain(`dueAt: ${JSON.stringify(when)}`);
    expect(queryText("createPost")).not.toContain("shareNow");
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update")!;
    expect((jobUpdate.payload as { status?: string }).status).toBe("scheduled");
    expect((jobUpdate.payload as { external_id?: string }).external_id).toBe("sched-9");
    expect((jobUpdate.payload as { scheduled_at?: string }).scheduled_at).toBe(when);
    expect((jobUpdate.payload as { published_at?: unknown }).published_at).toBeUndefined();
  });
});
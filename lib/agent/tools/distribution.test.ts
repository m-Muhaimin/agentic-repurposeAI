// Stage 4 (BYOB): Tests for the real distribution tool — posts an approved
// draft to Buffer and flips the job to published/failed. Never fabricates
// success: a missing connection / missing profile / Buffer rejection surfaces
// as ok:false + job `failed`.

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

// Archive a real per-test fetch response set for assertions.
const seenRoutes: Record<string, { ok: boolean; status?: number; headers?: Record<string, string>; body: unknown; calls?: { path: string; body: string | null }[] }> = {};

function mockFetchRoutes(routes: Record<string, { ok: boolean; status?: number; headers?: Record<string, string>; body: unknown }>) {
  Object.assign(seenRoutes, routes);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const key = String(url);
      const route = routes[key];
      (seenRoutes[key].calls ??= []).push({
        path: key,
        body: init?.body ? String(init.body) : null
      });
      return {
        ok: route.ok,
        status: route.status ?? (route.ok ? 200 : 400),
        headers: { get: (name: string) => route.headers?.[name] ?? null },
        json: async () => route.body,
        text: async () => JSON.stringify(route.body)
      } as Response;
    })
  );
}

beforeEach(() => {
  behavior = {};
  calls = [];
  for (const k of Object.keys(seenRoutes)) delete seenRoutes[k];
  delete seenRoutes["https://api.bufferapp.com/1/updates/create.json"];
  mockGetFreshToken.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("distributionTool — real Buffer publish path", () => {
  it("fails closed when the user has no Buffer connection", async () => {
    mockGetFreshToken.mockResolvedValue(null);
    const result = await distributionTool.run(
      { userId: "u1", runId: "run-1", mode: "execute" },
      { platform: "linkedin", outputId: "out-1" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("NO_BUFFER_CONNECTION");
    expect(calls.some((c) => c.table === "v4_distribution_jobs" && c.verb === "update")).toBe(false);
  });

  it("fails cleanly when the approved draft is missing", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": { ok: true, body: [] }
    });
    // outputs read returns nothing
    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "x", outputId: "out-missing" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Approved draft unavailable");
    // No network call was made — failed before touching Buffer.
    expect(seenRoutes["https://api.bufferapp.com/1/profiles.json?access_token=tok-1"]?.calls?.length ?? 0).toBe(0);
  });

  it("posts to Buffer and marks the job published on success", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    // Approved draft exists for this user
    behavior["outputs"] = { data: { id: "out-1", content: "Approved draft for LinkedIn." } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [
          { id: "54a1", service: "linkedin", service_username: "muhai" },
          { id: "54b2", service: "twitter", service_username: "muhai" }
        ]
      },
      "https://api.bufferapp.com/1/updates/create.json": {
        ok: true,
        body: { success: true, update_id: "5f3" }
      }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1" }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ updateId: "5f3", platform: "linkedin", scheduled: false });
    // Profile matched the linkedin profile, not twitter.
    const createCall = seenRoutes["https://api.bufferapp.com/1/updates/create.json"].calls![0]!;
    expect(createCall.body).toContain("profile_ids%5B%5D=54a1");
    expect(createCall.body).toContain("shorten=false");
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
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "tiktok" }]
      },
      "https://api.bufferapp.com/1/updates/create.json": { ok: true, body: { success: true, update_id: "u9" } }
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

  it("rejects newsletter honestly (no Buffer profile backs a newsletter)", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "linkedin" }]
      }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "newsletter", outputId: "out-1" }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No connected Buffer profile");
    // No create-update call was attempted.
    expect(seenRoutes["https://api.bufferapp.com/1/updates/create.json"]).toBeUndefined();
  });

  it("marks the job failed (with the real reason) when Buffer rejects the update", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "instagram" }]
      },
      "https://api.bufferapp.com/1/updates/create.json": {
        ok: false,
        status: 400,
        body: { success: false, errors: ["media_missing"] }
      }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "instagram", outputId: "out-1" }
    );

    expect(result.ok).toBe(false);
    // The create failed with Buffer's status + the body detail surfaced.
    expect(result.error).toContain("Buffer update create failed (400): media_missing");
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect((jobUpdate!.payload as { status?: string }).status).toBe("failed");
    expect(String((jobUpdate!.payload as { error_message?: string }).error_message)).toContain("media_missing");
  });

  it("never auto-retries on a rate limit — surfaces the retry window, job failed", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "youtube" }]
      },
      "https://api.bufferapp.com/1/updates/create.json": {
        ok: false,
        status: 429,
        headers: { "retry-after": "30" },
        body: { success: false }
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
    expect(seenRoutes["https://api.bufferapp.com/1/updates/create.json"].calls!.length).toBe(1);
  });

  it("honours an explicit Buffer profile selection (no guessing)", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [
          { id: "p1", service: "linkedin", service_username: "work" },
          { id: "p2", service: "linkedin", service_username: "personal" }
        ]
      },
      "https://api.bufferapp.com/1/updates/create.json": { ok: true, body: { success: true, update_id: "u1" } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1", profileIds: ["p2"] }
    );

    expect(result.ok).toBe(true);
    expect((result.data as { profileIds?: string[] }).profileIds).toEqual(["p2"]);
    const createCall = seenRoutes["https://api.bufferapp.com/1/updates/create.json"].calls![0]!;
    expect(createCall.body).toContain("profile_ids%5B%5D=p2");
    expect(createCall.body).not.toContain("profile_ids%5B%5D=p1");
  });

  it("rejects a requested profile that is not connected for the platform", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "linkedin", service_username: "work" }]
      },
      "https://api.bufferapp.com/1/updates/create.json": { ok: true, body: { success: true, update_id: "u1" } }
    });

    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "linkedin", outputId: "out-1", profileIds: ["nope"] }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not connected");
    expect(seenRoutes["https://api.bufferapp.com/1/updates/create.json"].calls).toBeUndefined();
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update");
    expect((jobUpdate!.payload as { status?: string }).status).toBe("failed");
  });

  it("scheduled send stays `scheduled` with the Buffer update id — never fake-published", async () => {
    mockGetFreshToken.mockResolvedValue({ token: "tok-1", refreshed: false });
    behavior["outputs"] = { data: { id: "out-1", content: "Draft" } };
    mockFetchRoutes({
      "https://api.bufferapp.com/1/profiles.json?access_token=tok-1": {
        ok: true,
        body: [{ id: "p1", service: "twitter" }]
      },
      "https://api.bufferapp.com/1/updates/create.json": { ok: true, body: { success: true, update_id: "sched-9" } }
    });

    const when = "2026-09-08T09:00:00.000Z";
    const result = await distributionTool.run(
      { userId: "u1", runId: "", mode: "assist" },
      { platform: "x", outputId: "out-1", scheduledAt: when }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ scheduled: true, scheduledAt: when });
    const createCall = seenRoutes["https://api.bufferapp.com/1/updates/create.json"].calls![0]!;
    expect(createCall.body).toContain(`scheduled_at=${encodeURIComponent(when)}`);
    const jobUpdate = calls.find((c) => c.table === "v4_distribution_jobs" && c.verb === "update")!;
    expect((jobUpdate.payload as { status?: string }).status).toBe("scheduled");
    expect((jobUpdate.payload as { external_id?: string }).external_id).toBe("sched-9");
    expect((jobUpdate.payload as { scheduled_at?: string }).scheduled_at).toBe(when);
    expect((jobUpdate.payload as { published_at?: unknown }).published_at).toBeUndefined();
  });
});
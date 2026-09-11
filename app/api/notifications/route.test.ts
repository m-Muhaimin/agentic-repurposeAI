// GET /api/notifications route tests. Guards the notifications API boundary:
// auth, limit clamping, keyset pagination, unread/type filters, the unread
// count, and fails-open degradation when the notifications migration hasn't
// been applied. The fake client records every query-chain call so assertions
// are precise about what the route actually sent to PostgREST.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; method: string; args: unknown[] };

const state = {
  user: { id: "user-1" } as { id: string } | null,
  rows: [] as Record<string, unknown>[],
  listError: null as { message: string } | null,
  count: 0,
  countError: null as { message: string } | null,
  calls: [] as Call[]
};

// Chainable fake: every filter/transform method records the call into the
// shared state.calls and returns a fresh link of the same chain; awaiting the
// chain resolves to the configured list or head-count result (a head:true
// select marks this chain as the unread-count query).
function makeChain(table: string, selectOpts?: { head?: boolean }): any {
  const record = (method: string, ...args: unknown[]) => {
    state.calls.push({ table, method, args });
    return makeChain(table, selectOpts);
  };
  const resolve = () => {
    if (selectOpts?.head) return { data: null, count: state.count, error: state.countError };
    return { data: state.rows, error: state.listError };
  };
  return {
    select: (cols?: string, opts?: unknown) => {
      state.calls.push({ table, method: "select", args: [cols, opts] });
      return makeChain(table, opts as { head?: boolean } | undefined);
    },
    eq: (col: string, val: unknown) => record("eq", col, val),
    is: (col: string, val: unknown) => record("is", col, val),
    or: (filter: string) => record("or", filter),
    order: (col: string, opts?: unknown) => record("order", col, opts),
    limit: (n: number) => record("limit", n),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled)
  };
}

const makeClient = () => ({
  auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
  from: (table: string) => makeChain(table)
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: makeClient,
  createServiceClient: () => ({})
}));

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "n-1",
  user_id: "user-1",
  type: "source.ready",
  title: "Source ready",
  body: "Your source is ready.",
  severity: "success",
  entity_type: null,
  entity_id: null,
  action_url: null,
  metadata: null,
  dedupe_key: null,
  expires_at: null,
  read_at: null,
  created_at: "2026-09-12T10:00:00.000Z",
  ...over
});

const listCalls = () => state.calls.filter((c) => c.table === "notifications");

describe("GET /api/notifications", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.rows = [];
    state.listError = null;
    state.count = 0;
    state.countError = null;
    state.calls = [];
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("returns notifications mapped to camelCase plus the unread count", async () => {
    state.rows = [
      row({ id: "n-1", read_at: null }),
      row({ id: "n-2", read_at: "2026-09-11T00:00:00.000Z" })
    ];
    state.count = 1;
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toEqual([
      expect.objectContaining({
        id: "n-1",
        userId: "user-1",
        readAt: null,
        createdAt: "2026-09-12T10:00:00.000Z"
      }),
      expect.objectContaining({ id: "n-2", readAt: "2026-09-11T00:00:00.000Z" })
    ]);
    expect(body.unreadCount).toBe(1);
    expect(body.nextCursor).toBeNull();
  });

  it("clamps limit to 1..50 (limit=999 → 50)", async () => {
    state.rows = Array.from({ length: 51 }, (_, i) => row({ id: `n-${i}` }));
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications?limit=999"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(50);
    // Internal fetch is limit + 1 = 51 — proves the clamp to 50 happened.
    expect(listCalls().filter((c) => c.method === "limit").map((c) => c.args[0])).toContain(51);
  });

  it("passes unreadOnly=true through as .is('read_at', null)", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    await GET(new Request("http://localhost/api/notifications?unreadOnly=true"));
    expect(listCalls()).toContainEqual({
      table: "notifications",
      method: "is",
      args: ["read_at", null]
    });
  });

  it("passes the type filter through as .eq('type', ...)", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    await GET(new Request("http://localhost/api/notifications?type=source.ready"));
    expect(listCalls()).toContainEqual({
      table: "notifications",
      method: "eq",
      args: ["type", "source.ready"]
    });
  });

  it("emits nextCursor when a full page plus one extra row was fetched", async () => {
    state.rows = Array.from({ length: 21 }, (_, i) =>
      row({ id: `n-${i}`, created_at: `2026-09-12T10:00:${String(i).padStart(2, "0")}.000Z` })
    );
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    const body = await res.json();
    expect(body.notifications).toHaveLength(20);
    // Cursor of the last RETURNED row (the 21st row only proves more exist).
    expect(body.nextCursor).toBe(`${encodeURIComponent("2026-09-12T10:00:19.000Z")}|n-19`);
  });

  it("returns nextCursor null when the page is not full", async () => {
    state.rows = [row()];
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
  });

  it("applies the keyset cursor filter when a valid cursor is provided", async () => {
    const id = "5f0b2f4e-8e3c-4b6a-9d1e-2a3b4c5d6e7f";
    const cursor = `${encodeURIComponent("2026-09-12T10:00:00.000Z")}|${id}`;
    const { GET } = await import("@/app/api/notifications/route");
    await GET(new Request(`http://localhost/api/notifications?cursor=${cursor}`));
    const orCalls = listCalls().filter((c) => c.method === "or");
    expect(orCalls).toHaveLength(1);
    expect(orCalls[0].args[0]).toBe(
      `created_at.lt.2026-09-12T10:00:00.000Z,and(created_at.eq.2026-09-12T10:00:00.000Z,id.lt.${id})`
    );
  });

  it("treats a garbage cursor as no cursor instead of 400", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications?cursor=not-a-cursor"));
    expect(res.status).toBe(200);
    expect(listCalls().filter((c) => c.method === "or")).toHaveLength(0);
  });

  it("treats a cursor with a valid timestamp but non-UUID id as no cursor", async () => {
    const cursor = `${encodeURIComponent("2026-09-12T10:00:00.000Z")}|not-a-uuid`;
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request(`http://localhost/api/notifications?cursor=${cursor}`));
    expect(res.status).toBe(200);
    expect(listCalls().filter((c) => c.method === "or")).toHaveLength(0);
  });

  it("treats a calendar-invalid but regex-valid cursor timestamp as no cursor", async () => {
    // 2026-02-30 passes the naive Date.parse non-NaN check (V8 normalizes it
    // to Mar 2) but Postgres rejects the literal — the round-trip validation
    // must drop it so the route serves the newest page instead of a 500.
    const id = "5f0b2f4e-8e3c-4b6a-9d1e-2a3b4c5d6e7f";
    const cursor = `${encodeURIComponent("2026-02-30T00:00:00Z")}|${id}`;
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request(`http://localhost/api/notifications?cursor=${cursor}`));
    expect(res.status).toBe(200);
    expect(listCalls().filter((c) => c.method === "or")).toHaveLength(0);
  });

  it("derives user_id from the session, never from the query", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    await GET(new Request("http://localhost/api/notifications?user_id=attacker-1"));
    const eqCalls = listCalls().filter((c) => c.method === "eq" && c.args[0] === "user_id");
    // One from the list query, one from the unread-count query.
    expect(eqCalls).toHaveLength(2);
    for (const c of eqCalls) expect(c.args[1]).toBe("user-1");
  });

  it("fails open with an empty list when the notifications table is missing", async () => {
    state.listError = {
      message: "Could not find the table 'public.notifications' in the schema cache"
    };
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifications: [], nextCursor: null, unreadCount: 0 });
  });

  it("returns 500 on other list errors", async () => {
    state.listError = { message: "db down" };
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to load notifications");
  });
});
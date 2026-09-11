// POST /api/notifications/read-all route tests. Guards the mark-all-read
// boundary: auth, the RPC call shape, the marked count in the response, and
// the fail-closed 503 when the notifications migration hasn't been applied.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  user: { id: "user-1" } as { id: string } | null,
  rpc: { data: 3 as unknown, error: null as { message: string } | null },
  rpcCalls: [] as { fn: string; args: unknown }[]
};

const makeClient = () => ({
  auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
  rpc: (fn: string, args?: unknown) => {
    state.rpcCalls.push({ fn, args });
    return Promise.resolve(state.rpc);
  }
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: makeClient,
  createServiceClient: () => ({})
}));

describe("POST /api/notifications/read-all", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.rpc = { data: 3, error: null };
    state.rpcCalls = [];
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const { POST } = await import("@/app/api/notifications/read-all/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("calls notifications_mark_all_read and returns the marked count", async () => {
    const { POST } = await import("@/app/api/notifications/read-all/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marked: 3 });
    expect(state.rpcCalls).toEqual([{ fn: "notifications_mark_all_read", args: undefined }]);
  });

  it("returns marked: null when the RPC returns no count", async () => {
    state.rpc = { data: null, error: null };
    const { POST } = await import("@/app/api/notifications/read-all/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marked: null });
  });

  it("returns 503 with a migration hint when the RPC is missing", async () => {
    state.rpc = {
      data: null,
      error: {
        message: "Could not find the function public.notifications_mark_all_read() in the schema cache"
      }
    };
    const { POST } = await import("@/app/api/notifications/read-all/route");
    const res = await POST();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(
      "Notifications are not available yet — the notifications migration has not been applied."
    );
  });
});
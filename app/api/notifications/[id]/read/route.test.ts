// POST /api/notifications/[id]/read route tests. Guards the mark-read
// boundary: auth, id validation, the RPC call shape, the not-owned 404, and
// the fail-closed 503 when the notifications migration hasn't been applied.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  user: { id: "user-1" } as { id: string } | null,
  rpc: { data: true as unknown, error: null as { message: string } | null },
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

const post = (id: string) =>
  import("@/app/api/notifications/[id]/read/route").then(({ POST }) =>
    POST(new Request(`http://localhost/api/notifications/${id}/read`), { params: { id } })
  );

// A well-formed UUID — the RPC-path tests must use one (non-UUID ids now 404
// before the RPC is ever called).
const VALID_ID = "11111111-2222-4333-8444-555555555555";

describe("POST /api/notifications/[id]/read", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.rpc = { data: true, error: null };
    state.rpcCalls = [];
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const res = await post("n-1");
    expect(res.status).toBe(401);
  });

  it("returns 400 when the id is missing", async () => {
    const res = await post("");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Missing notification id");
  });

  it("calls notifications_mark_read with the id and returns ok", async () => {
    const res = await post(VALID_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.rpcCalls).toEqual([{ fn: "notifications_mark_read", args: { p_id: VALID_ID } }]);
  });

  it("returns 404 when the RPC reports the notification is not owned/missing", async () => {
    state.rpc = { data: false, error: null };
    const res = await post(VALID_ID);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Notification not found");
  });

  it("returns 404 for a non-UUID id and never calls the RPC", async () => {
    const res = await post("not-a-uuid");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Notification not found");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("returns 503 with a migration hint when the RPC is missing", async () => {
    state.rpc = {
      data: null,
      error: {
        message: "Could not find the function public.notifications_mark_read(p_id) in the schema cache"
      }
    };
    const res = await post(VALID_ID);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(
      "Notifications are not available yet — the notifications migration has not been applied."
    );
  });

  it("returns 500 on other RPC errors", async () => {
    state.rpc = { data: null, error: { message: "boom" } };
    const res = await post(VALID_ID);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to mark notification as read");
  });
});
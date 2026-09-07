import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

type SupabaseState = {
  user: { id: string } | null;
  sources: { error: { message?: string } | null; data: unknown[] };
  outputs: { error: { message?: string } | null; data: unknown[] };
  jobs: { error: { message?: string } | null; data: unknown[] };
  user_prompts: { error: { message?: string } | null; data: unknown[] };
};

const state: SupabaseState = {
  user: { id: "user-1" },
  sources: { error: null, data: [{ id: "s1" }] },
  outputs: { error: null, data: [] },
  jobs: { error: null, data: [] },
  user_prompts: { error: null, data: [] }
};

const from = (table: string) => ({
  select: () => ({
    eq: () =>
      table === "sources"
        ? Promise.resolve(state.sources)
        : table === "outputs"
        ? Promise.resolve(state.outputs)
        : table === "jobs"
        ? Promise.resolve(state.jobs)
        : Promise.resolve(state.user_prompts)
  })
});

const makeClient = () => ({
  auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
  from
});

let adminDeleteUser: (userId: string) => Promise<{ error: { message?: string } | null }>;

const makeServiceClient = () => ({
  auth: { admin: { deleteUser: adminDeleteUser } }
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: makeClient,
  createServiceClient: makeServiceClient
}));

describe("account/delete route", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const { PATCH } = await import("@/app/api/account/delete/route");
    const res = await PATCH();
    expect(res.status).toBe(401);
  });

  it("deletes the authenticated user via service role", async () => {
    adminDeleteUser = vi.fn().mockResolvedValue({ error: null });
    const { PATCH } = await import("@/app/api/account/delete/route");
    const res = await PATCH();
    expect(res.status).toBe(200);
    expect(adminDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 on admin delete failure", async () => {
    adminDeleteUser = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const { PATCH } = await import("@/app/api/account/delete/route");
    const res = await PATCH();
    expect(res.status).toBe(500);
  });
});

describe("account/export route", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.sources = { error: null, data: [{ id: "s1" }] };
    state.outputs = { error: null, data: [{ id: "o1" }] };
    state.jobs = { error: null, data: [{ id: "j1" }] };
    state.user_prompts = { error: null, data: [{ id: "p1" }] };
  });

  it("returns 401 when unauthenticated", async () => {
    state.user = null;
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns an export envelope with user data", async () => {
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-1");
    expect(body.sources).toEqual([{ id: "s1" }]);
    expect(body.outputs).toEqual([{ id: "o1" }]);
    expect(body.jobs).toEqual([{ id: "j1" }]);
    expect(body.prompts).toEqual([{ id: "p1" }]);
    expect(body.exportedAt).toBeTruthy();
  });

  it("returns 500 on source fetch failure", async () => {
    state.sources = { error: { message: "db down" }, data: [] };
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

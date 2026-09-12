import { beforeEach, describe, expect, it, vi } from "vitest";

const { runStorageRetentionSweepMock } = vi.hoisted(() => ({
  runStorageRetentionSweepMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({})
}));

vi.mock("@/lib/storage-retention/sweep", () => ({
  runStorageRetentionSweep: runStorageRetentionSweepMock
}));

const URL = "https://verv.local/api/cron/storage-retention";

describe("GET /api/cron/storage-retention", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    runStorageRetentionSweepMock.mockReset();
    runStorageRetentionSweepMock.mockResolvedValue({ usersExamined: 0, objectsDeleted: 0, errors: [] });
  });

  it("401s without CRON_SECRET set", async () => {
    const { GET } = await import("@/app/api/cron/storage-retention/route");
    const res = await GET(new Request(URL, { headers: { authorization: "Bearer whatever" } }));
    expect(res.status).toBe(401);
    expect(runStorageRetentionSweepMock).not.toHaveBeenCalled();
  });

  it("401s with a wrong Bearer token", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    const { GET } = await import("@/app/api/cron/storage-retention/route");
    const res = await GET(new Request(URL, { headers: { authorization: "Bearer wrong-secret" } }));
    expect(res.status).toBe(401);
    expect(runStorageRetentionSweepMock).not.toHaveBeenCalled();
  });

  it("401s with no Authorization header", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    const { GET } = await import("@/app/api/cron/storage-retention/route");
    const res = await GET(new Request(URL));
    expect(res.status).toBe(401);
    expect(runStorageRetentionSweepMock).not.toHaveBeenCalled();
  });

  it("401s with a non-Bearer Authorization header", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    const { GET } = await import("@/app/api/cron/storage-retention/route");
    const res = await GET(new Request(URL, { headers: { authorization: "Token wrong-secret" } }));
    expect(res.status).toBe(401);
    expect(runStorageRetentionSweepMock).not.toHaveBeenCalled();
  });

  it("401s with an empty Bearer token", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    const { GET } = await import("@/app/api/cron/storage-retention/route");
    const res = await GET(new Request(URL, { headers: { authorization: "Bearer " } }));
    expect(res.status).toBe(401);
    expect(runStorageRetentionSweepMock).not.toHaveBeenCalled();
  });

  it("returns 200 + the sweep summary with the correct Bearer token", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    runStorageRetentionSweepMock.mockResolvedValue({ usersExamined: 7, objectsDeleted: 4, errors: [] });
    const { GET } = await import("@/app/api/cron/storage-retention/route");

    const res = await GET(new Request(URL, { headers: { authorization: "Bearer correct-horse-battery-staple" } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ usersExamined: 7, objectsDeleted: 4, errors: [] });
    expect(runStorageRetentionSweepMock).toHaveBeenCalledWith({ service: {} });
  });

  it("returns 500 + message (no stack) when the sweep fails", async () => {
    process.env.CRON_SECRET = "correct-horse-battery-staple";
    runStorageRetentionSweepMock.mockRejectedValueOnce(new Error("boom"));
    const { GET } = await import("@/app/api/cron/storage-retention/route");

    const res = await GET(new Request(URL, { headers: { authorization: "Bearer correct-horse-battery-staple" } }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("boom");
    expect(body.stack).toBeUndefined();
  });
});
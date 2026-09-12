// Unit tests for the orphan-only storage retention sweep. The `ctx.service`
// seam is mocked (storage list/remove, `from().select`, `auth.admin.listUsers`)
// in the same style as `lib/ingestion/*.test.ts`.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { runStorageRetentionSweep } from "./sweep";

type FakeEntry = {
  name: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

const file = (name: string, ageMs: number): FakeEntry => ({
  name,
  metadata: {},
  created_at: new Date(Date.now() - ageMs).toISOString()
});
const folder = (name: string): FakeEntry => ({ name, metadata: null, created_at: null });

interface FakeServiceOpts {
  users?: string[];
  knownPaths?: string[];
  /** prefix → entries (pagination applied by the fake). */
  tree?: Record<string, FakeEntry[]>;
  removeImpl?: (paths: string[]) => { error: { message?: string; statusCode?: string } | null };
  /** Fail the `sources.storage_path` read (fail-closed path). */
  selectError?: { message: string };
}

function fakeService(opts: FakeServiceOpts) {
  const removed: string[][] = [];
  const listCalls: { prefix: string; offset: number }[] = [];
  const users = opts.users ?? [];

  const bucket = {
    async list(prefix: string, { limit, offset }: { limit: number; offset: number }) {
      listCalls.push({ prefix, offset });
      const entries = opts.tree?.[prefix] ?? [];
      return { data: entries.slice(offset, offset + limit), error: null };
    },
    async remove(paths: string[]) {
      removed.push(paths);
      if (opts.removeImpl) return opts.removeImpl(paths);
      return { data: [], error: null };
    }
  };

  const service = {
    auth: {
      admin: {
        async listUsers({ page }: { page: number }) {
          const start = (page - 1) * 1000;
          const slice = users.slice(start, start + 1000).map((id) => ({ id }));
          return {
            data: {
              users: slice,
              aud: "authenticated",
              nextPage: start + 1000 < users.length ? page + 1 : null,
              lastPage: Math.max(1, Math.ceil(users.length / 1000)),
              total: users.length
            },
            error: null
          };
        }
      }
    },
    from() {
      return {
        async select() {
          if (opts.selectError) return { data: null, error: opts.selectError };
          return { data: (opts.knownPaths ?? []).map((p) => ({ storage_path: p })), error: null };
        }
      };
    },
    storage: { from: () => bucket }
  } as unknown as SupabaseClient<Database>;

  return { service, removed, listCalls };
}

const DAY = 24 * 60 * 60 * 1000;

describe("runStorageRetentionSweep", () => {
  it("deletes an aged orphan with no sources row and keeps a matched object", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: ["u1/a.mp3"],
      tree: {
        "": [folder("u1")],
        u1: [file("a.mp3", 30 * DAY), file("b.mp3", 30 * DAY)]
      }
    });

    const summary = await runStorageRetentionSweep({ service });

    expect(summary).toEqual({ usersExamined: 1, objectsDeleted: 1, errors: [] });
    expect(removed).toEqual([["u1/b.mp3"]]); // a.mp3 has a live sources row
  });

  it("keeps a recent orphan inside the grace window", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1")],
        u1: [file("fresh.mp3", 2 * 60 * 60 * 1000)] // 2h old < 24h grace
      }
    });

    const summary = await runStorageRetentionSweep({ service });

    expect(summary).toEqual({ usersExamined: 1, objectsDeleted: 0, errors: [] });
    expect(removed).toEqual([]);
  });

  it("honors an explicit graceMs (0 = age check effectively disabled for past objects)", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1")],
        u1: [file("recent.mp3", 1000)]
      }
    });

    const summary = await runStorageRetentionSweep({ service }, { graceMs: 0 });

    expect(summary.objectsDeleted).toBe(1);
    expect(removed).toEqual([["u1/recent.mp3"]]);
  });

  it("removes a deleted user's prefix entirely, including nested folders, regardless of age", async () => {
    const { service, removed } = fakeService({
      users: ["u1"], // u2 is gone
      knownPaths: ["u2/buffer-post/p1"], // even a path that "exists" is purged for a deleted user
      tree: {
        "": [folder("u1"), folder("u2")],
        u1: [file("mine.mp3", 1 * 60 * 60 * 1000)], // live user, recent → kept
        u2: [file("old.mp3", 1 * 60 * 60 * 1000), folder("youtube"), folder("buffer-post")],
        "u2/youtube": [file("x.mp3", 30 * DAY)],
        "u2/buffer-post": [file("p1", 30 * DAY)]
      }
    });

    const summary = await runStorageRetentionSweep({ service });

    expect(summary.usersExamined).toBe(2);
    expect(summary.objectsDeleted).toBe(3);
    // u2 fully purged (nested paths relative to the prefix), u1 untouched.
    expect(removed).toEqual([["u2/old.mp3", "u2/youtube/x.mp3", "u2/buffer-post/p1"]]);
    expect(summary.errors).toEqual([]);
  });

  it("tolerates remove() on a missing object (treats it as success)", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1")],
        u1: [file("gone.mp3", 30 * DAY)]
      },
      removeImpl: () => ({ error: { message: "The resource was not found", statusCode: "404" } })
    });

    const summary = await runStorageRetentionSweep({ service });

    expect(summary).toEqual({ usersExamined: 1, objectsDeleted: 1, errors: [] });
    expect(removed).toEqual([["u1/gone.mp3"]]);
  });

  it("records a real remove failure and continues the sweep", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1"), folder("u2")],
        u1: [file("a.mp3", 30 * DAY)],
        u2: [file("b.mp3", 30 * DAY)]
      },
      removeImpl: (paths) => ({ error: { message: `boom on ${paths.join(",")}` } })
    });

    const summary = await runStorageRetentionSweep({ service });

    expect(summary.objectsDeleted).toBe(0);
    expect(summary.errors.length).toBe(2); // one per chunk, both prefixes attempted
    expect(removed.length).toBe(2); // both prefixes reached — sweep never aborts
  });

  it("respects the maxDeletes bound mid-chunk", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1")],
        u1: [file("a.mp3", 30 * DAY), file("b.mp3", 30 * DAY), file("c.mp3", 30 * DAY)]
      }
    });

    const summary = await runStorageRetentionSweep({ service }, { maxDeletes: 2 });

    expect(summary.objectsDeleted).toBe(2);
    expect(removed).toEqual([["u1/a.mp3", "u1/b.mp3"]]); // c.mp3 untouched
  });

  it("stops examining prefixes at maxUsers", async () => {
    const { service, listCalls } = fakeService({
      users: [],
      tree: {
        "": [folder("u1"), folder("u2"), folder("u3")],
        u1: [],
        u2: [],
        u3: []
      }
    });

    const summary = await runStorageRetentionSweep({ service }, { maxUsers: 2 });

    expect(summary.usersExamined).toBe(2);
    expect(listCalls.filter((c) => c.prefix === "u3")).toEqual([]); // never started
  });

  it("paginates a prefix's object listing (2 pages of results)", async () => {
    const orphans = Array.from({ length: 1500 }, (_, i) => file(`f${i}.mp3`, 30 * DAY));
    const { service, removed, listCalls } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: {
        "": [folder("u1")],
        u1: orphans
      }
    });

    const summary = await runStorageRetentionSweep({ service }, { maxDeletes: 2000 });

    expect(summary.objectsDeleted).toBe(1500);
    // 15 removal chunks of ≤100, covering every object from both pages.
    expect(removed.length).toBe(15);
    expect(removed.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(removed.flat().length).toBe(1500);
    // Both list pages were consumed for u1.
    expect(listCalls.filter((c) => c.prefix === "u1").map((c) => c.offset)).toEqual([0, 1000]);
  });

  it("paginates the root listing (2 pages of folders)", async () => {
    const prefixes = Array.from({ length: 1500 }, (_, i) => folder(`u${i}`));
    const { service, listCalls } = fakeService({
      users: [],
      tree: { "": prefixes }
    });

    const summary = await runStorageRetentionSweep({ service }, { maxUsers: 2000 });

    expect(summary.usersExamined).toBe(1500);
    expect(listCalls.filter((c) => c.prefix === "").map((c) => c.offset)).toEqual([0, 1000]);
  });

  it("throws (fail closed) when the sources read fails — deletes nothing", async () => {
    const { service, removed } = fakeService({
      users: ["u1"],
      knownPaths: [],
      tree: { "": [folder("u1")], u1: [file("a.mp3", 30 * DAY)] },
      selectError: { message: "db down" }
    });

    await expect(runStorageRetentionSweep({ service })).rejects.toThrow(/sources\.storage_path/);
    expect(removed).toEqual([]); // nothing was deleted
  });
});
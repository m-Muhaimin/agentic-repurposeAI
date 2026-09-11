// Phase 3: createNotification contract tests. Mocks the service client (same
// chainable-fake convention as lib/buffer/connections.test.ts) and the logger
// (capturing calls) so the exact insert payload, dedupe behavior, sanitization,
// and never-throw guarantee are asserted without a live DB.

import { describe, expect, it, vi, beforeEach } from "vitest";

let behavior: Record<string, unknown> = {};

interface CallRecord {
  table: string;
  op: "insert" | "upsert" | "lookup";
  payload: Record<string, unknown> | null;
  conflict: string | null;
  ignored: boolean;
  selected: boolean;
  eqs: Array<[string, unknown]>;
  terminal: "single" | "maybeSingle";
}
const calls: CallRecord[] = [];

const infos: Array<{ event: string; fields: Record<string, unknown> }> = [];
const warns: Array<{ event: string; fields: Record<string, unknown> }> = [];

vi.mock("@/lib/logger", () => ({
  log: {
    info: (event: string, fields: Record<string, unknown> = {}) => {
      infos.push({ event, fields });
    },
    warn: (event: string, fields: Record<string, unknown> = {}) => {
      warns.push({ event, fields });
    },
    error: () => {}
  }
}));

function chain() {
  const algorithm = {
    table: "" as string,
    op: "lookup" as CallRecord["op"],
    payload: null as Record<string, unknown> | null,
    conflict: null as string | null,
    ignored: false,
    selected: false,
    eqs: [] as Array<[string, unknown]>,
    eq(column: string, value: unknown) {
      this.eqs.push([column, value]);
      return this;
    },
    select() {
      this.selected = true;
      return this;
    },
    single() {
      calls.push({
        table: this.table,
        op: this.op,
        payload: this.payload,
        conflict: this.conflict,
        ignored: this.ignored,
        selected: this.selected,
        eqs: this.eqs,
        terminal: "single"
      });
      if (behavior["single_throws"]) throw new Error("kaboom");
      const r = (behavior["insert_result"] as Record<string, unknown> | undefined) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
    maybeSingle() {
      calls.push({
        table: this.table,
        op: this.op,
        payload: this.payload,
        conflict: this.conflict,
        ignored: this.ignored,
        selected: this.selected,
        eqs: this.eqs,
        terminal: "maybeSingle"
      });
      const r = (behavior["lookup_result"] as Record<string, unknown> | undefined) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
    insert(payload: Record<string, unknown>) {
      this.op = "insert";
      this.payload = payload;
      return this;
    },
    upsert(payload: Record<string, unknown>, options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
      this.op = "upsert";
      this.payload = payload;
      this.conflict = options.onConflict ?? null;
      this.ignored = options.ignoreDuplicates ?? false;
      return this;
    }
  };
  return {
    from(table: string) {
      const fresh = { ...algorithm };
      fresh.table = table;
      fresh.eqs = [];
      return fresh;
    }
  };
}

const fakeService = { from: (t: string) => chain().from(t) };
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => fakeService }));

import { createNotification, notificationRowToRecord } from "./create";
import { isSafeActionUrl } from "./types";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "n1",
    user_id: "u1",
    type: "source.ready",
    title: "Your source is ready",
    body: "Your source has been processed and is ready for VervAI.",
    severity: "info",
    entity_type: null,
    entity_id: null,
    action_url: null,
    metadata: null,
    dedupe_key: null,
    expires_at: null,
    read_at: null,
    created_at: "2026-09-12T00:00:00.000Z",
    ...overrides
  };
}

const BASE_INPUT = {
  userId: "u1",
  type: "source.ready" as const,
  title: "Your source is ready",
  body: "Your source has been processed and is ready for VervAI."
};

beforeEach(() => {
  behavior = {};
  calls.length = 0;
  infos.length = 0;
  warns.length = 0;
});

describe("createNotification — valid insert", () => {
  it("inserts with defaults (severity info, nulls) and returns the camelCase record", async () => {
    behavior["insert_result"] = { data: row(), error: null };
    const record = await createNotification({ ...BASE_INPUT, title: "  Your source is ready  " });

    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("insert");
    expect(calls[0].conflict).toBeNull(); // no dedupe path for a plain insert
    expect(calls[0].selected).toBe(true);
    expect(calls[0].payload).toEqual({
      user_id: "u1",
      type: "source.ready",
      title: "Your source is ready", // trimmed
      body: "Your source has been processed and is ready for VervAI.",
      severity: "info", // default
      entity_type: null,
      entity_id: null,
      action_url: null,
      metadata: null,
      dedupe_key: null,
      expires_at: null
    });

    expect(record).not.toBeNull();
    expect(record).toEqual({
      id: "n1",
      userId: "u1",
      type: "source.ready",
      title: "Your source is ready",
      body: "Your source has been processed and is ready for VervAI.",
      severity: "info",
      entityType: null,
      entityId: null,
      actionUrl: null,
      metadata: null,
      dedupeKey: null,
      expiresAt: null,
      readAt: null,
      createdAt: "2026-09-12T00:00:00.000Z"
    });
    expect(infos).toContainEqual({
      event: "notification.created",
      fields: { type: "source.ready", user_id: "u1", entity_type: null, entity_id: null }
    });
  });

  it("passes entity/url/metadata/dedupe/expiry through to the insert payload", async () => {
    behavior["insert_result"] = { data: row({ user_id: "u1", type: "publish.scheduled", severity: "info" }), error: null };
    await createNotification({
      ...BASE_INPUT,
      type: "publish.scheduled",
      severity: "info",
      entityType: "distribution_job",
      entityId: "j1",
      actionUrl: "/publish",
      metadata: { channel: "linkedin" },
      dedupeKey: "publish.scheduled:distribution_job:j1",
      expiresAt: "2026-10-01T00:00:00.000Z"
    });

    expect(calls[0].payload).toMatchObject({
      type: "publish.scheduled",
      entity_type: "distribution_job",
      entity_id: "j1",
      action_url: "/publish",
      metadata: { channel: "linkedin" },
      dedupe_key: "publish.scheduled:distribution_job:j1",
      expires_at: "2026-10-01T00:00:00.000Z"
    });
  });
});

describe("createNotification — validation rejects", () => {
  it("rejects an empty userId", async () => {
    expect(await createNotification({ ...BASE_INPUT, userId: "  " })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "user_id_empty" } });
  });

  it("rejects a type outside the taxonomy", async () => {
    expect(await createNotification({ ...BASE_INPUT, type: "bogus.type" as never })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "invalid_type", type: "bogus.type" } });
  });

  it("rejects an invalid severity", async () => {
    expect(await createNotification({ ...BASE_INPUT, severity: "loud" as never })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "invalid_severity" } });
  });

  it("rejects empty title/body after trim", async () => {
    expect(await createNotification({ ...BASE_INPUT, title: "   " })).toBeNull();
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "title_or_body_empty" } });
    warns.length = 0;
    expect(await createNotification({ ...BASE_INPUT, body: "\n \n" })).toBeNull();
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "title_or_body_empty" } });
    expect(calls).toHaveLength(0);
  });

  it("rejects unsafe action URLs (schemes, protocol-relative, backslash, control chars, unknown prefix)", async () => {
    for (const actionUrl of [
      "https://evil.com",
      "//evil.com",
      "javascript:alert(1)",
      "/library\\secret",
      "/agent\n",
      "/evil",
      "mailto:x@y.com"
    ]) {
      warns.length = 0;
      expect(await createNotification({ ...BASE_INPUT, actionUrl })).toBeNull();
      expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "unsafe_action_url" } });
    }
    expect(calls).toHaveLength(0);
  });

  it("accepts an allowlisted action URL", async () => {
    behavior["insert_result"] = { data: row(), error: null };
    const record = await createNotification({ ...BASE_INPUT, actionUrl: "/library?tab=all" });
    expect(record).not.toBeNull();
    expect(calls[0].payload).toMatchObject({ action_url: "/library?tab=all" });
  });

  it("rejects a dedupeKey longer than 255 chars", async () => {
    expect(await createNotification({ ...BASE_INPUT, dedupeKey: "k".repeat(256) })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "dedupe_key_too_long" } });
  });

  it("rejects cyclic metadata", async () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(await createNotification({ ...BASE_INPUT, metadata: circular })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "metadata_invalid" } });
  });

  it("rejects metadata containing functions / undefined (stringify would silently drop them)", async () => {
    expect(await createNotification({ ...BASE_INPUT, metadata: { fn: () => 1 } })).toBeNull();
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "metadata_invalid" } });
    warns.length = 0;
    expect(await createNotification({ ...BASE_INPUT, metadata: { missing: undefined } })).toBeNull();
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "metadata_invalid" } });
    expect(calls).toHaveLength(0);
  });

  it("rejects metadata larger than 2048 bytes", async () => {
    expect(await createNotification({ ...BASE_INPUT, metadata: { big: "x".repeat(2100) } })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(warns[0]).toMatchObject({ event: "notification.rejected", fields: { reason: "metadata_too_large" } });
  });
});

describe("createNotification — sanitize", () => {
  it("strips control characters from title (all) and body (keeping newlines), trimming both", async () => {
    behavior["insert_result"] = { data: row(), error: null };
    await createNotification({
      ...BASE_INPUT,
      title: " \x00He\x01llo\x02\n",
      body: "Line1\x00\x01\nLine2\r\nmore"
    });
    expect(calls[0].payload).toMatchObject({
      title: "Hello", // \n stripped from titles
      body: "Line1\nLine2\nmore" // \r stripped, \n kept, \x00/\x01 stripped
    });
  });

  it("truncates over-long title (160) and body (1000) silently", async () => {
    behavior["insert_result"] = { data: row(), error: null };
    await createNotification({ ...BASE_INPUT, title: "t".repeat(200), body: "b".repeat(1200) });
    expect(calls[0].payload).toMatchObject({ title: "t".repeat(160), body: "b".repeat(1000) });
  });

  it("nulls empty entity fields and caps entity lengths", async () => {
    behavior["insert_result"] = { data: row(), error: null };
    await createNotification({
      ...BASE_INPUT,
      entityType: "   ",
      entityId: "x".repeat(300)
    });
    expect(calls[0].payload).toMatchObject({ entity_type: null, entity_id: "x".repeat(128) });
  });
});

describe("createNotification — dedupe", () => {
  it("uses onConflict dedupe and returns the existing row on a PGRST116 dedupe hit", async () => {
    behavior["insert_result"] = {
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows", hint: null }
    };
    behavior["lookup_result"] = { data: row({ dedupe_key: "k1" }), error: null };

    const record = await createNotification({ ...BASE_INPUT, dedupeKey: "k1" });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ op: "upsert", conflict: "user_id,dedupe_key", ignored: true, terminal: "single" });
    expect(calls[0].payload).toMatchObject({ dedupe_key: "k1" });
    // The follow-up re-select targets the dedupe key with maybeSingle, scoped
    // to the same user_id so the service client can never resolve a
    // cross-tenant row.
    expect(calls[1]).toMatchObject({ op: "lookup", terminal: "maybeSingle", selected: true });
    expect(calls[1].eqs).toEqual([
      ["dedupe_key", "k1"],
      ["user_id", "u1"]
    ]);

    expect(record).not.toBeNull();
    expect(record!.dedupeKey).toBe("k1");
    expect(infos).toContainEqual({ event: "notification.dedupe", fields: { dedupeKey: "k1" } });
  });

  it("returns null when the dedupe-hit follow-up misses", async () => {
    behavior["insert_result"] = { data: null, error: { code: "PGRST116", message: "no rows" } };
    behavior["lookup_result"] = { data: null, error: null };
    expect(await createNotification({ ...BASE_INPUT, dedupeKey: "k1" })).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("logs and returns null when the follow-up select errors", async () => {
    behavior["insert_result"] = { data: null, error: { code: "PGRST116", message: "no rows" } };
    behavior["lookup_result"] = { data: null, error: { message: "table missing", code: "42P01" } };
    expect(await createNotification({ ...BASE_INPUT, dedupeKey: "k1" })).toBeNull();
    expect(calls).toHaveLength(2);
  });
});

describe("createNotification — failures never throw", () => {
  it("returns null + notification.create_failed on a DB error", async () => {
    behavior["insert_result"] = { data: null, error: { message: "relation does not exist", code: "42P01" } };
    const record = await createNotification(BASE_INPUT);
    expect(record).toBeNull();
    expect(warns[0]).toMatchObject({ event: "notification.create_failed" });
    expect(warns[0].fields).toMatchObject({ type: "source.ready", user_id: "u1" });
  });

  it("swallows an unexpected throw from the DB layer", async () => {
    behavior["single_throws"] = true;
    const record = await createNotification(BASE_INPUT);
    expect(record).toBeNull();
    expect(warns.some((w) => w.event === "notification.create_failed")).toBe(true);
  });
});

describe("notificationRowToRecord", () => {
  it("maps a snake_case DB row to the camelCase domain shape", () => {
    const record = notificationRowToRecord(row({ entity_type: "source", read_at: "2026-09-13T00:00:00.000Z" }) as never);
    expect(record.entityType).toBe("source");
    expect(record.readAt).toBe("2026-09-13T00:00:00.000Z");
    expect(record.userId).toBe("u1");
    expect(record.severity).toBe("info");
  });
});

describe("isSafeActionUrl", () => {
  it("accepts internal prefixed paths", () => {
    for (const url of ["/agent", "/agent?run=abc", "/library", "/settings/usage", "/repurpose/o1", "/publish", "/notifications", "/upload", "/dashboard"]) {
      expect(isSafeActionUrl(url)).toBe(true);
    }
  });

  it("rejects nullish, empty, bare, and unsafe values", () => {
    for (const url of [
      null,
      undefined,
      "",
      "/",
      "agent",
      "https://evil.com",
      "//evil.com",
      "javascript:alert(1)",
      "/library\\secret",
      "/agent\n",
      "/evil"
    ]) {
      expect(isSafeActionUrl(url)).toBe(false);
    }
  });
});
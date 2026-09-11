import { describe, expect, it } from "vitest";
import { mergeNotificationsById } from "./merge";

const n = (id: string, createdAt: string) => ({ id, createdAt });

describe("mergeNotificationsById", () => {
  it("prepends new incoming rows ahead of existing ones", () => {
    const existing = [n("b", "2026-01-02T00:00:00Z"), n("a", "2026-01-01T00:00:00Z")];
    const merged = mergeNotificationsById(existing, [n("c", "2026-01-03T00:00:00Z")]);
    expect(merged.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("replaces an existing row with the incoming version of the same id", () => {
    const existing: Array<{ id: string; createdAt: string; readAt: string | null }> = [
      { id: "a", createdAt: "2026-01-01T00:00:00Z", readAt: null }
    ];
    const incoming = [
      { id: "a", createdAt: "2026-01-01T00:00:00Z", readAt: "2026-01-02T00:00:00Z" }
    ];
    const merged = mergeNotificationsById(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].readAt).toBe("2026-01-02T00:00:00Z");
  });

  it("does not duplicate ids across overlapping pages (load-more / poll overlap)", () => {
    const existing = [
      n("c", "2026-01-03T00:00:00Z"),
      n("b", "2026-01-02T00:00:00Z"),
      n("a", "2026-01-01T00:00:00Z")
    ];
    const page2 = [n("b", "2026-01-02T00:00:00Z"), n("z-new", "2026-01-01T00:00:00Z")];
    const merged = mergeNotificationsById(existing, page2);
    expect(merged.map((x) => x.id)).toEqual(["c", "b", "z-new", "a"]);
  });

  it("breaks createdAt ties on id descending", () => {
    const merged = mergeNotificationsById([], [n("a", "2026-01-01T00:00:00Z"), n("b", "2026-01-01T00:00:00Z")]);
    expect(merged.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("returns a fresh array and never mutates its inputs", () => {
    const existing = [n("a", "2026-01-01T00:00:00Z")];
    const incoming = [n("b", "2026-01-02T00:00:00Z")];
    const merged = mergeNotificationsById(existing, incoming);
    expect(merged).not.toBe(existing);
    expect(merged).not.toBe(incoming);
    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });
});
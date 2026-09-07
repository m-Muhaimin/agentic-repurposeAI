// P12: Tests for retention window math — bounded query windows, no data loss.

import { describe, expect, it } from "vitest";
import {
  retentionWindow,
  withinWindow,
  capAt,
  RETENTION_DEFAULTS
} from "@/lib/agent/retention";

const NOW = new Date("2026-09-07T00:00:00Z").getTime();

describe("retentionWindow", () => {
  it("defaults to the bounded lookback window when no options are given", () => {
    const w = retentionWindow({ now: new Date(NOW) });
    expect(w.unlimited).toBe(false);
    expect(Date.parse(w.from)).toBe(NOW - RETENTION_DEFAULTS.RUN_HISTORY_MS);
  });

  it("honors unlimited (returns all history honestly, with no lower bound)", () => {
    const w = retentionWindow({ unlimited: true });
    expect(w.unlimited).toBe(true);
    expect(w.from).toBe("");
  });

  it("clamps an explicit since to the retention cap (no unbounded scans)", () => {
    // A since far in the past must be clamped up to the window.
    const farPast = "2000-01-01T00:00:00Z";
    const w = retentionWindow({ since: farPast, now: new Date(NOW) });
    expect(Date.parse(w.from)).toBe(NOW - RETENTION_DEFAULTS.RUN_HISTORY_MS);
  });

  it("keeps a recent since inside the window", () => {
    const recent = new Date(NOW - 60_000).toISOString();
    const w = retentionWindow({ since: recent, now: new Date(NOW) });
    expect(Date.parse(w.from)).toBe(Date.parse(recent));
  });

  it("treats an invalid since as the full default window", () => {
    const w = retentionWindow({ since: "not-a-date", now: new Date(NOW) });
    expect(Date.parse(w.from)).toBe(NOW - RETENTION_DEFAULTS.RUN_HISTORY_MS);
  });

  it("accepts an explicit lookbackMs (per-surface retention caps)", () => {
    const w = retentionWindow({ now: new Date(NOW), lookbackMs: 30 * 24 * 60 * 60 * 1000 });
    expect(Date.parse(w.from)).toBe(NOW - 30 * 24 * 60 * 60 * 1000);
  });
});

describe("withinWindow", () => {
  it("includes and excludes rows honestly around the bound", () => {
    const w = retentionWindow({ since: new Date(NOW - 1000).toISOString(), now: new Date(NOW) });
    expect(withinWindow(new Date(NOW - 2000).toISOString(), w)).toBe(false);
    expect(withinWindow(new Date(NOW - 500).toISOString(), w)).toBe(true);
  });

  it("includes everything for an unlimited window", () => {
    expect(withinWindow("2000-01-01T00:00:00Z", { from: "", unlimited: true })).toBe(true);
  });
});

describe("capAt", () => {
  it("bounds a count at the max", () => {
    expect(capAt(500, 100)).toBe(100);
    expect(capAt(50, 100)).toBe(50);
    expect(capAt(-5, 100)).toBe(0);
  });
});

describe("RETENTION_DEFAULTS", () => {
  it("exposes bounded, sane caps (data retained, query window bounded)", () => {
    expect(RETENTION_DEFAULTS.RUN_HISTORY_MS).toBeGreaterThan(0);
    expect(RETENTION_DEFAULTS.MAX_RUNS).toBeGreaterThan(0);
    expect(RETENTION_DEFAULTS.MAX_STEPS_PER_RUN).toBeGreaterThan(0);
    expect(RETENTION_DEFAULTS.MAX_QUEUE_ITEMS).toBeGreaterThan(0);
  });
});

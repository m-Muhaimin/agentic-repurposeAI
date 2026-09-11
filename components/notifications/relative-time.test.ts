import { describe, expect, it } from "vitest";
import { relativeTimeLabel } from "./relative-time";

const NOW = Date.parse("2026-09-12T12:00:00Z");

describe("relativeTimeLabel", () => {
  it("renders 'just now' for anything under a minute", () => {
    expect(relativeTimeLabel(new Date(NOW - 30_000).toISOString(), NOW)).toBe("just now");
  });

  it("renders minutes ago", () => {
    expect(relativeTimeLabel(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 minutes ago");
  });

  it("renders hours ago", () => {
    expect(relativeTimeLabel(new Date(NOW - 2 * 3_600_000).toISOString(), NOW)).toBe("2 hours ago");
  });

  it("renders 'yesterday' for a day-old notification", () => {
    expect(relativeTimeLabel(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe("yesterday");
  });

  it("treats future timestamps as 'just now' (clock skew)", () => {
    expect(relativeTimeLabel(new Date(NOW + 60_000).toISOString(), NOW)).toBe("just now");
  });

  it("returns an empty string for invalid input", () => {
    expect(relativeTimeLabel("not-a-date", NOW)).toBe("");
  });
});
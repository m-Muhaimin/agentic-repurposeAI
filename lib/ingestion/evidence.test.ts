// Phase 1: evidence & provenance tests — quote pinning, grounding quality.

import { describe, expect, it } from "vitest";
import {
  normalizeText,
  provenanceOf,
  evidenceForQuote,
  evidenceForQuotes,
  isPinned
} from "@/lib/ingestion/evidence";
import type { TranscriptDocument } from "@/lib/ingestion/types";

const DOC: TranscriptDocument = {
  text: "We believe grit beats talent. The founder stayed up late shipping. Customers noticed.",
  segments: [
    { startMs: 0, endMs: 1000, text: "We believe grit beats talent." },
    { startMs: 1100, endMs: 2000, text: "The founder stayed up late shipping." }
  ],
  provider: "youtube_captions",
  providerTranscriptId: "caption-1",
  language: "en",
  durationSeconds: 2,
  source: { type: "youtube", url: "https://youtu.be/abc", title: "My video", author: "Channel", authorId: "ch1" }
};

describe("normalizeText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeText("  Grit  Beats   Talent ")).toBe("grit beats talent");
  });
});

describe("provenanceOf", () => {
  it("reports who produced it and from where", () => {
    const p = provenanceOf(DOC);
    expect(p.provider).toBe("youtube_captions");
    expect(p.providerTranscriptId).toBe("caption-1");
    expect(p.sourceType).toBe("youtube");
    expect(p.sourceUrl).toBe("https://youtu.be/abc");
    expect(p.sourceTitle).toBe("My video");
    expect(p.sourceAuthor).toBe("Channel");
    expect(p.segmentCount).toBe(2);
  });

  it("handles docs without optional fields", () => {
    const p = provenanceOf({ text: "hi", source: { type: "transcript" } } as TranscriptDocument);
    expect(p.provider).toBeNull();
    expect(p.segmentCount).toBe(0);
    expect(p.sourceAuthorId).toBeNull();
  });
});

describe("evidenceForQuote", () => {
  it("pins a verbatim quote to its segment with timestamps", () => {
    const e = evidenceForQuote(DOC, "Grit beats talent.");
    expect(e).not.toBeNull();
    expect(e?.startMs).toBe(0);
    expect(e?.endMs).toBe(1000);
    expect(e?.sourceIndex).toBe(0);
    expect(isPinned(e!)).toBe(true);
  });

  it("is case/whitespace tolerant but verbatim", () => {
    const e = evidenceForQuote(DOC, "  GRIT   beats   talent. ");
    expect(e?.sourceIndex).toBe(0);
  });

  it("flattens a cross-segment quote with null timestamps (not pinned)", () => {
    const e = evidenceForQuote(DOC, "grit beats talent. the founder");
    expect(e).not.toBeNull();
    expect(e?.startMs).toBeNull();
    expect(e?.sourceIndex).toBe(-1);
    expect(isPinned(e!)).toBe(false);
  });

  it("returns null when the quote is not grounded in the source", () => {
    expect(evidenceForQuote(DOC, "aliens landed in sector seven")).toBeNull();
    expect(evidenceForQuote(DOC, "   ")).toBeNull();
  });

  it("falls back to the whole text when there are no segments", () => {
    const e = evidenceForQuote({ text: "plain text source", source: { type: "transcript" } }, "text source");
    expect(e).not.toBeNull();
    expect(e?.sourceIndex).toBe(-1);
    expect(e?.startMs).toBeNull();
  });
});

describe("evidenceForQuotes", () => {
  it("resolves each quote that exists in the source and drops the rest", () => {
    const { provenance, evidence } = evidenceForQuotes(DOC, [
      "grit beats talent",
      "stayed up late",
      "not grounded at all"
    ]);
    expect(provenance.provider).toBe("youtube_captions");
    expect(isPinned(evidence[0])).toBe(true);
    expect(evidence[0].sourceIndex).toBe(0);
    expect(evidence[1].sourceIndex).toBe(1);
    expect(evidence).toHaveLength(2);
  });
});
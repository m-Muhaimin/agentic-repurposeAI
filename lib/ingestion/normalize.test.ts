// Phase 2: normalize — extracted content → canonical TranscriptDocument,
// including structure + metadata + the evidence vocabulary Phase 1 defined.

import { describe, expect, it } from "vitest";
import { toCanonicalContent, ensureMeaningful, isDeferred, withExtractedStructure } from "@/lib/ingestion/normalize";
import { evidenceForQuote } from "@/lib/ingestion/evidence";
import { isIngestionFailure } from "@/lib/ingestion/failure";
import type { IngestSource } from "@/lib/ingestion/types";

const SRC: IngestSource = {
  id: "s1",
  user_id: "u1",
  source_type: "transcript",
  title: "Quarterly report",
  source_url: null,
  storage_path: "u1/report.pdf"
};

describe("toCanonicalContent", () => {
  it("shapes extracted document content into the canonical contract", () => {
    const doc = toCanonicalContent(
      {
        kind: "pdf",
        text: "Page one content.",
        structure: { blocks: [{ type: "heading", text: "Q3", level: 1 }] },
        metadata: { pages: 3, characters: 14 }
      },
      SRC,
      { provider: "transcript_file" }
    );
    expect(doc.text).toBe("Page one content.");
    expect(doc.provider).toBe("transcript_file");
    expect(doc.source.type).toBe("transcript");
    expect(doc.source.title).toBe("Quarterly report");
    expect(doc.metadata?.pages).toBe(3);
    expect(doc.structure?.blocks[0]).toEqual({ type: "heading", text: "Q3", level: 1 });
  });

  it("flag deferred image content instead of fabricating it", () => {
    const doc = toCanonicalContent(
      { kind: "image", text: "", structure: null, metadata: {}, deferred: true, deferReason: "no vision engine" },
      SRC
    );
    expect(isDeferred(doc)).toBe(true);
    expect(doc.text).toBe("");
    expect(doc.metadata?.analysisDeferred).toBe(true);
  });
});

describe("ensureMeaningful", () => {
  it("rejects an empty non-deferred document", () => {
    const doc = toCanonicalContent({ kind: "pdf", text: "", structure: null, metadata: {} }, SRC);
    let caught: unknown;
    try {
      ensureMeaningful(doc);
    } catch (e) {
      caught = e;
    }
    expect(isIngestionFailure(caught)).toBe(true);
    expect((caught as Error).message).toContain("nothing to repurpose");
  });

  it("accepts an empty document that explicitly defers analysis", () => {
    const doc = toCanonicalContent(
      { kind: "image", text: "", structure: null, metadata: {}, deferred: true },
      SRC
    );
    expect(ensureMeaningful(doc)).toBe(doc);
  });
});

describe("evidence integration", () => {
  it("quotes resolve against a normalized document through Phase-1 evidence", () => {
    const doc = toCanonicalContent(
      { kind: "markdown", text: "Revenue grew 20% this quarter.", structure: null, metadata: {} },
      SRC
    );
    const evidence = evidenceForQuote(doc, "Revenue grew 20%");
    expect(evidence).not.toBeNull();
    expect(evidence?.quote).toContain("Revenue grew 20%");
  });
});

describe("withExtractedStructure", () => {
  it("attaches structure + metadata without disturbing segments", () => {
    const base = {
      text: "a\nb",
      segments: [{ startMs: 0, endMs: 10, text: "a" }],
      source: { type: "transcript" as const }
    };
    const doc = withExtractedStructure(base, { blocks: [{ type: "paragraph", text: "a b" }] }, { pages: 1 });
    expect(doc.segments).toHaveLength(1);
    expect(doc.structure?.blocks).toHaveLength(1);
    expect(doc.metadata?.pages).toBe(1);
  });
});
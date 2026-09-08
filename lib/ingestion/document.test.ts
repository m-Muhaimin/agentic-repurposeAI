// Phase 2: document adapter (pdf/docx/markdown) — gates, extractor seam,
// canonical output, idempotent reuse, failure semantics.

import { describe, expect, it, vi } from "vitest";
import { documentProvider } from "@/lib/ingestion/document";
import { contentHash, idempotencyKey } from "@/lib/ingestion/idempotency";
import { isIngestionFailure, type IngestionFailure } from "@/lib/ingestion/failure";
import type { IngestSource, IngestionContext } from "@/lib/ingestion/types";
import type { ContentStore } from "@/lib/ingestion/idempotency";
import type { ExtractedContent } from "@/lib/ingestion/extract";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n1 0 obj fake pdf data");

interface FakeFile {
  bytes?: Uint8Array;
  size?: number;
  mime?: string;
}

function fakeCtx(files: Record<string, FakeFile>): IngestionContext {
  return {
    service: {
      storage: {
        from() {
          return {
            async info(path: string) {
              const f = files[path];
              return f
                ? { data: { metadata: { size: f.size ?? f.bytes?.byteLength ?? 0, mimetype: f.mime ?? "" } }, error: null }
                : { data: null, error: { message: "object not found" } };
            },
            async download(path: string) {
              const f = files[path];
              return f
                ? { data: new Blob([f.bytes ? (f.bytes.buffer as ArrayBuffer) : new ArrayBuffer(0)]), error: null }
                : { data: null, error: { message: "object not found" } };
            }
          };
        }
      }
    } as never,
    onProgress: () => {}
  };
}

const pdfSource = (over: Partial<IngestSource> = {}) =>
  ({
    id: "s1",
    user_id: "u1",
    source_type: "transcript",
    title: "Report",
    source_url: null,
    storage_path: "u1/report.pdf",
    ...over
  }) as IngestSource;

const pdfContent: ExtractedContent = {
  kind: "pdf",
  text: "Extracted PDF body.",
  structure: { blocks: [{ type: "paragraph", text: "Extracted PDF body." }] },
  metadata: { pages: 2 }
};

describe("canHandle / validate", () => {
  const provider = documentProvider();

  it("claims pdf/docx/markdown rows and nothing else", () => {
    expect(provider.canHandle?.(pdfSource())).toBe(true);
    expect(provider.canHandle?.(pdfSource({ storage_path: "u1/a.docx" }))).toBe(true);
    expect(provider.canHandle?.(pdfSource({ storage_path: "u1/a.md" }))).toBe(true);
    expect(provider.canHandle?.(pdfSource({ storage_path: "u1/a.png" }))).toBe(false);
    expect(provider.canHandle?.(pdfSource({ storage_path: "u1/a.txt" }))).toBe(false);
  });

  it("validation is a strict extension pass", () => {
    expect(provider.validate?.(pdfSource())?.ok).toBe(true);
    expect(provider.validate?.(pdfSource({ storage_path: "u1/a.exe" }))?.ok).toBe(false);
  });
});

describe("ingest", () => {
  it("pdf: injected extractor → canonical TranscriptDocument with structure + metadata", async () => {
    const provider = documentProvider({ extractors: { pdf: async () => pdfContent } });
    const doc = await provider.ingest(pdfSource(), fakeCtx({ "u1/report.pdf": { bytes: PDF_BYTES, mime: "application/pdf" } }));
    expect(doc.text).toBe("Extracted PDF body.");
    expect(doc.provider).toBe("transcript_file");
    expect(doc.source.type).toBe("transcript");
    expect(doc.structure?.blocks[0]?.type).toBe("paragraph");
    expect(doc.metadata?.pages).toBe(2);
  });

  it("markdown: real extractor produces structure headings without any injected engine", async () => {
    const provider = documentProvider();
    const md = "# Hello\n\nBody text.\n";
    const doc = await provider.ingest(
      pdfSource({ storage_path: "u1/guide.md" }),
      fakeCtx({ "u1/guide.md": { bytes: new TextEncoder().encode(md), mime: "text/markdown" } })
    );
    expect(doc.text).toBe(md.trim());
    expect(doc.structure?.blocks.find((b) => b.type === "heading")?.text).toBe("Hello");
  });

  it("pdf without an injected extractor fails as a human failed state, never a stack", async () => {
    const provider = documentProvider();
    const err = await provider.ingest(pdfSource(), fakeCtx({ "u1/report.pdf": { bytes: PDF_BYTES, mime: "application/pdf" } })).then(
      () => null,
      (e: unknown) => e
    );
    expect(isIngestionFailure(err)).toBe(true);
    const f = err as IngestionFailure;
    expect(f.stage).toBe("failed");
    expect(f.message).toContain("No transcript was produced from this PDF file");
    expect(f.message).toContain("PDF text extraction is coming soon");
    expect(f.nextStep).toBeTruthy();
    expect(f.message).not.toMatch(/^\s+at /m);
  });

  it("rejects a reported size over the shared upload cap before extracting", async () => {
    const extractor = vi.fn(async () => pdfContent);
    const provider = documentProvider({ extractors: { pdf: extractor } });
    const err = await provider
      .ingest(pdfSource(), fakeCtx({ "u1/report.pdf": { bytes: PDF_BYTES, size: 250 * 1024 * 1024, mime: "application/pdf" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    expect((err as IngestionFailure).message).toContain("200 MB limit");
    expect(extractor).not.toHaveBeenCalled();
  });

  it("rejects a MIME that contradicts the document kind", async () => {
    const provider = documentProvider({ extractors: { pdf: async () => pdfContent } });
    const err = await provider
      .ingest(pdfSource(), fakeCtx({ "u1/report.pdf": { bytes: PDF_BYTES, mime: "image/png" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    expect((err as IngestionFailure).message).toContain("doesn't look like a PDF");
  });
});

describe("idempotent re-ingestion", () => {
  it("re-ingesting identical bytes reuses the prior transcript without re-extracting", async () => {
    const extractor = vi.fn(async () => pdfContent);
    const priorSource: IngestSource = { ...pdfSource(), id: "s-prior" };
    let recorded: { key: string; sourceId: string } | null = null;
    const store: ContentStore = {
      async findSourceByHash(_u, _t, key, excludeId) {
        return recorded && recorded.key === key && recorded.sourceId !== excludeId ? priorSource : null;
      },
      async transcriptTextFor(id) {
        return id === priorSource.id ? "prior transcript text" : null;
      }
    };

    const provider = documentProvider({ extractors: { pdf: extractor }, store });
    const ctx = fakeCtx({ "u1/report.pdf": { bytes: PDF_BYTES, mime: "application/pdf" } });

    const first = await provider.ingest(pdfSource(), ctx);
    expect(first.text).toBe("Extracted PDF body.");
    expect(extractor).toHaveBeenCalledTimes(1);

    // The store now remembers these bytes were ingested for this user+kind.
    recorded = { key: idempotencyKey("pdf", contentHash(PDF_BYTES)), sourceId: priorSource.id };
    const second = await provider.ingest(pdfSource(), ctx);
    expect(second.text).toBe("prior transcript text");
    expect(extractor).toHaveBeenCalledTimes(1);
  });
});
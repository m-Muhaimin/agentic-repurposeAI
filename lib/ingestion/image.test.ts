// Phase 2: image adapter — honest deferred-analyze default; injected vision
// extractor flows through the canonical pipeline; same gates + idempotency.

import { describe, expect, it } from "vitest";
import { imageProvider } from "@/lib/ingestion/image";
import { isIngestionFailure, type IngestionFailure } from "@/lib/ingestion/failure";
import type { IngestSource, IngestionContext } from "@/lib/ingestion/types";
import type { ExtractedContent } from "@/lib/ingestion/extract";

const PNG_BYTES = new TextEncoder().encode("\u0089PNG\r\n\u001a\n fake png bytes");

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

const imgSource = (over: Partial<IngestSource> = {}) =>
  ({
    id: "s1",
    user_id: "u1",
    source_type: "transcript",
    title: "Screenshot",
    source_url: null,
    storage_path: "u1/shot.png",
    ...over
  }) as IngestSource;

describe("canHandle / validate", () => {
  const provider = imageProvider();

  it("claims image kinds and nothing else", () => {
    expect(provider.canHandle?.(imgSource())).toBe(true);
    expect(provider.canHandle?.(imgSource({ storage_path: "u1/a.jpeg" }))).toBe(true);
    expect(provider.canHandle?.(imgSource({ storage_path: "u1/a.heic" }))).toBe(true);
    expect(provider.canHandle?.(imgSource({ storage_path: "u1/a.pdf" }))).toBe(false);
  });
});

describe("ingest", () => {
  it("default (no vision engine) is a deferred, human failed state — never fabricates content", async () => {
    const provider = imageProvider();
    const err = await provider
      .ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, mime: "image/png" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    const f = err as IngestionFailure;
    expect(f.stage).toBe("failed");
    expect(f.message).toContain("stored as a source asset but has not been analyzed");
    expect(f.message).toContain("never assumes what an image contains");
    expect(f.nextStep).toBeTruthy();
    expect(f.message).not.toMatch(/^\s+at /m);
  });

  it("injected vision extractor produces a canonical document", async () => {
    const provider = imageProvider({
      extractor: async (): Promise<ExtractedContent> => ({
        kind: "image",
        text: "A chart showing revenue up 20%.",
        structure: null,
        metadata: { width: 1200, height: 800 }
      })
    });
    const doc = await provider.ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, mime: "image/png" } }));
    expect(doc.text).toBe("A chart showing revenue up 20%.");
    expect(doc.provider).toBe("transcript_file");
    expect(doc.metadata?.width).toBe(1200);
    expect(doc.metadata?.height).toBe(800);
  });

  it("an injected extractor that defers produces a flagged (not fabricated) document", async () => {
    const provider = imageProvider({
      extractor: async (): Promise<ExtractedContent> => ({
        kind: "image",
        text: "",
        structure: null,
        metadata: {},
        deferred: true,
        deferReason: "waits for analyzing stage"
      })
    });
    const doc = await provider.ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, mime: "image/png" } }));
    expect(doc.text).toBe("");
    expect(doc.metadata?.analysisDeferred).toBe(true);
  });

  it("respects the size gate and MIME contradiction checks", async () => {
    const provider = imageProvider();
    const tooBig = await provider
      .ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, size: 250 * 1024 * 1024, mime: "image/png" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(tooBig)).toBe(true);
    expect((tooBig as IngestionFailure).message).toContain("200 MB limit");

    const badMime = await provider
      .ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, mime: "text/plain" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(badMime)).toBe(true);
    expect((badMime as IngestionFailure).message).toContain("doesn't look like an image");
  });
});

describe("normalize", () => {
  it("normalize passes extracted content through untouched", async () => {
    const provider = imageProvider({
      extractor: async (): Promise<ExtractedContent> => ({
        kind: "image",
        text: "Landscape mountains.",
        structure: null,
        metadata: {}
      })
    });
    const doc = await provider.ingest(imgSource(), fakeCtx({ "u1/shot.png": { bytes: PNG_BYTES, mime: "image/png" } }));
    const normalized = provider.normalize?.(doc);
    expect(normalized?.text).toBe("Landscape mountains.");
  });
});
// Phase 2: text-file adapter (txt/srt/vtt) — real parsing, reuse of the Phase-1
// transcript pipeline, server-side gates, and binary-as-text rejection.

import { describe, expect, it } from "vitest";
import { textFileProvider } from "@/lib/ingestion/text-file";
import { isIngestionFailure, type IngestionFailure } from "@/lib/ingestion/failure";
import { parseSrt, parseVtt } from "@/lib/captions";
import type { IngestSource, IngestionContext } from "@/lib/ingestion/types";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const SRT = "1\n00:00:01,000 --> 00:00:03,000\nHello world.\n\n2\n00:00:03,500 --> 00:00:05,000\nAnd goodbye.\n";
const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello from VTT.\n";
const TXT = "Just a plain text file.\n\nNo timestamps involved.\n";

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

const src = (path: string, over: Partial<IngestSource> = {}) =>
  ({ id: "s1", user_id: "u1", source_type: "transcript", title: "captions", source_url: null, storage_path: path, ...over }) as IngestSource;

describe("canHandle / validate", () => {
  const provider = textFileProvider();

  it("claims txt/srt/vtt and legacy generic transcript rows", () => {
    expect(provider.canHandle?.(src("u1/captions.srt"))).toBe(true);
    expect(provider.canHandle?.(src("u1/captions.vtt"))).toBe(true);
    expect(provider.canHandle?.(src("u1/notes.txt"))).toBe(true);
    expect(provider.canHandle?.(src("u1/no_extension"))).toBe(true);
    expect(provider.canHandle?.(src("u1/doc.pdf"))).toBe(false);
  });

  it("validation rejects unknown extensions", () => {
    expect(provider.validate?.(src("u1/notes.txt"))?.ok).toBe(true);
    expect(provider.validate?.(src("u1/virus.exe"))?.ok).toBe(false);
  });
});

describe("ingest — srt/vtt/txt → transcript_file", () => {
  const provider = textFileProvider();

  it("srt rows parse into timestamped segments via the Phase-1 pipeline", async () => {
    const doc = await provider.ingest(src("u1/captions.srt"), fakeCtx({ "u1/captions.srt": { bytes: bytes(SRT), mime: "application/x-subrip" } }));
    expect(doc.provider).toBe("transcript_file");
    expect(doc.source.type).toBe("transcript");
    expect(doc.segments?.[0]).toMatchObject({ startMs: 1000, endMs: 3000, text: "Hello world." });
    expect(doc.text).toContain("Hello world.");
    expect(doc.text).toContain("And goodbye.");
  });

  it("vtt rows parse into timestamped segments", async () => {
    const doc = await provider.ingest(src("u1/captions.vtt"), fakeCtx({ "u1/captions.vtt": { bytes: bytes(VTT), mime: "text/vtt" } }));
    expect(doc.segments?.[0]).toMatchObject({ startMs: 1000, endMs: 3000, text: "Hello from VTT." });
  });

  it("txt rows become a single plain block with no invented timestamps", async () => {
    const doc = await provider.ingest(src("u1/notes.txt"), fakeCtx({ "u1/notes.txt": { bytes: bytes(TXT), mime: "text/plain" } }));
    expect(doc.text).toBe(TXT.trim());
    expect(doc.segments).toBeUndefined();
  });

  it("captions round-trip against the shared lib/captions parsers", () => {
    expect(parseSrt(SRT)[0]).toMatchObject({ startMs: 1000, endMs: 3000 });
    expect(parseVtt(VTT)[0]).toMatchObject({ startMs: 1000, endMs: 3000 });
  });
});

describe("gates", () => {
  const provider = textFileProvider();

  it("rejects a txt blob that is actually binary (NUL bytes) as 'binary data'", async () => {
    const bin = new Uint8Array([0x00, 0xff, 0xfe, ...bytes("looks like text")]);
    const err = await provider.ingest(src("u1/notes.txt"), fakeCtx({ "u1/notes.txt": { bytes: bin, mime: "text/plain" } }))
      .then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    expect((err as IngestionFailure).message).toContain("binary data");
  });

  it("rejects size-over-cap rows before parsing", async () => {
    const err = await provider.ingest(
      src("u1/captions.srt", { storage_path: "u1/captions.srt" }),
      fakeCtx({ "u1/captions.srt": { bytes: bytes(SRT), size: 250 * 1024 * 1024, mime: "application/x-subrip" } })
    ).then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    expect((err as IngestionFailure).message).toContain("200 MB limit");
  });

  it("fails cleanly (no stack) when the storage object is missing", async () => {
    const err = await provider.ingest(src("u1/missing.srt"), fakeCtx({})).then(() => null, (e: unknown) => e);
    expect(isIngestionFailure(err)).toBe(true);
    expect((err as IngestionFailure).message).not.toMatch(/^\s+at /m);
  });
});
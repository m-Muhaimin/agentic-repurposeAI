// Phase 1+2: registry tests — provider registration, kind resolution,
// dispatch routing, taxonomy mapping.

import { describe, expect, it } from "vitest";
import {
  registerIngestionProvider,
  providerFor,
  providerForKind,
  getRegisteredKinds,
  getRegisteredSourceTypes,
  ingestSource,
  mapKindToSourceType,
  resolveKind,
  type IngestionProvider,
  type SourceKind
} from "@/lib/ingestion/registry";
import type { IngestSource, IngestionContext, TranscriptDocument } from "@/lib/ingestion/types";

function fakeProvider(): IngestionProvider {
  return {
    sourceTypes: ["audio"] as const,
    ingest: async () =>
      ({
        text: "hello world",
        provider: "assemblyai",
        source: { type: "audio" }
      }) as TranscriptDocument
  };
}

const SRC = { id: "s1", user_id: "u1", source_type: "audio", title: null, source_url: null, storage_path: "u1/a.mp3" } as IngestSource;
const CTX = { service: {} as never } as IngestionContext;

describe("mapKindToSourceType", () => {
  const SERVER_UNKNOWN: SourceKind[] = ["file", "url", "podcast"];

  it("folds today's intake kinds onto the DB enum", () => {
    expect(mapKindToSourceType("youtube")).toBe("youtube");
    expect(mapKindToSourceType("audio")).toBe("audio");
    expect(mapKindToSourceType("video")).toBe("video");
    expect(mapKindToSourceType("transcript")).toBe("transcript");
  });

  it("rides every stored-file kind on the existing transcript source_type", () => {
    for (const kind of ["pdf", "docx", "markdown", "txt", "srt", "vtt", "image"] as SourceKind[]) {
      expect(mapKindToSourceType(kind)).toBe("transcript");
    }
  });

  it("returns null for kinds with no real intake path yet", () => {
    for (const kind of SERVER_UNKNOWN) expect(mapKindToSourceType(kind)).toBeNull();
  });
});

describe("resolveKind", () => {
  it("resolves identifier kinds directly", () => {
    expect(resolveKind({ ...SRC, source_type: "youtube", storage_path: "u1/v.mp4" })).toBe("youtube");
    expect(resolveKind(SRC)).toBe("audio");
    expect(resolveKind({ ...SRC, source_type: "video" })).toBe("video");
  });

  it("derives file-backed transcript rows from their storage extension", () => {
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.pdf" })).toBe("pdf");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.md" })).toBe("markdown");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.txt" })).toBe("txt");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.srt" })).toBe("srt");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.vtt" })).toBe("vtt");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/a.png" })).toBe("image");
  });

  it("falls back to transcript for unknown or missing file extensions", () => {
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: "u1/notes.bin" })).toBe("transcript");
    expect(resolveKind({ ...SRC, source_type: "transcript", storage_path: null })).toBe("transcript");
  });
});

describe("registerIngestionProvider / providerFor", () => {
  it("registers a provider under each of its source types (first registration wins)", () => {
    registerIngestionProvider(fakeProvider());
    registerIngestionProvider(fakeProvider());
    expect(providerFor("audio")).not.toBeNull();
    expect(providerFor("audio")?.sourceTypes).toContain("audio");
    expect(getRegisteredSourceTypes().filter((t) => t === "audio").length).toBe(1);
  });

  it("returns null for unregistered types", () => {
    expect(providerFor("youtube")).toBeNull();
  });

  it("exposes kind-scoped providers and the set of registered kinds", () => {
    registerIngestionProvider({
      sourceTypes: [] as const,
      kinds: ["pdf", "docx"] as const,
      ingest: async () => ({ text: "kind-routed", provider: "transcript_file", source: { type: "transcript" } }) as TranscriptDocument
    });
    expect(providerForKind("pdf")).not.toBeNull();
    expect(providerForKind("docx")).not.toBeNull();
    expect(providerForKind("txt")).toBeNull();
    expect(getRegisteredKinds()).toContain("pdf");
  });
});

describe("ingestSource (dispatch through registry)", () => {
  it("delegates to the registered provider for its source type", async () => {
    const doc = await ingestSource(SRC, CTX);
    expect(doc.text).toBe("hello world");
  });

  it("routes by resolved kind before falling back to source_type", async () => {
    const doc = await ingestSource({ ...SRC, source_type: "transcript", storage_path: "u1/a.pdf" }, CTX);
    expect(doc.text).toBe("kind-routed");
  });

  it("throws for a source type with no provider", async () => {
    await expect(
      ingestSource({ ...SRC, source_type: "youtube" }, CTX)
    ).rejects.toThrow("Unsupported source type");
  });

  it("throws when a resolved file kind has no kind-aware provider and the fallback type is unregistered", async () => {
    await expect(
      ingestSource({ ...SRC, source_type: "transcript", storage_path: "u1/notes.txt" }, CTX)
    ).rejects.toThrow("Unsupported source type");
  });
});
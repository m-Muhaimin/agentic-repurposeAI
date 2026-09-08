// Text-file intake adapter: the existing transcript provider (TXT/SRT/VTT)
// registered under concrete kinds so the registry can dispatch a stored file by
// its true extension. Extraction delegates to the untouched Phase-1
// ingestTranscript body; this adapter only adds the strict per-kind server-side
// gates (extension allowlist, size, reported MIME, binary-as-text NUL probe)
// that the transcript path previously relied on the upload UI for.

import { resolveFileKind, validateFile } from "./kinds";
import { ingestTranscript } from "./transcript";
import { readAndValidateFile } from "./file-gate";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";
import type { IngestionProvider, IngestValidation } from "./registry";

export function textFileProvider(): IngestionProvider {
  return {
    sourceTypes: ["transcript"],
    // "transcript" stays as a kind so legacy rows with no recognized extension
    // still resolve to this provider (which then rejects them with the same
    // "Unsupported transcript file type" guard as today).
    kinds: ["transcript", "txt", "srt", "vtt"],
    canHandle(source: IngestSource): boolean {
      const kind = resolveFileKind(source.storage_path ?? "");
      return kind === null || kind === "txt" || kind === "srt" || kind === "vtt";
    },
    validate(source: IngestSource): IngestValidation {
      const result = validateFile({ fileName: baseName(source) });
      return { ok: result.ok, errors: result.errors, kind: result.kind };
    },
    ingest: async (source, ctx) => {
      await gateStoredFile(source, ctx);
      return ingestTranscript(source, ctx);
    },
    normalize: (doc: TranscriptDocument) => doc
  };
}

async function gateStoredFile(source: IngestSource, ctx: IngestionContext): Promise<void> {
  const storagePath = source.storage_path;
  if (!storagePath) throw new Error("Transcript source has no file to read.");
  // Server-side size + MIME gate (matches upload.ts's 200 MB family of caps)
  // and the binary-as-text NUL probe — textOnly keeps text kinds from being
  // fooled by a binary payload renamed to .txt/.srt/.vtt.
  await readAndValidateFile(ctx, storagePath, { textOnly: true });
}

function baseName(source: IngestSource): string {
  return (source.storage_path ?? "").split("/").pop() ?? "";
}
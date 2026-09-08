// Document intake adapter: PDF, DOCX and Markdown, all behind the existing
// worker seam. Files arrive as `source_type = 'transcript'` rows with a
// storage_path (the only DB enum that fits a stored file), and this provider
// dispatches on the actual extension via the registry's kind resolution.
//
// PDF/DOCX text engines are injected through an extractor seam — the default
// is an honest "not wired up yet" failure, never fabricated content. Markdown
// is extracted for real (structure detection included). Idempotency: identical
// bytes for the same user + kind are detected via sha256 and reusing the
// earlier transcript instead of re-extracting.

import {
  validateFile,
  type FileValidation,
  type FileBackedKind
} from "./kinds";
import { resolveFileKind } from "./kinds";
import type { IngestSource } from "./types";
import type { IngestionProvider, IngestValidation } from "./registry";
import type { ContentExtractor } from "./extract";
import { makePdfExtractor, makeDocxExtractor, extractMarkdown } from "./extract";
import { toCanonicalContent, ensureMeaningful } from "./normalize";
import { findReusableSource, contentHash, persistHashSafely, type ContentStore } from "./idempotency";
import { readAndValidateFile } from "./file-gate";
import { ingestionFailure, isIngestionFailure, toFailReason } from "./failure";

const DOCUMENT_KINDS: readonly FileBackedKind[] = ["pdf", "docx", "markdown"];

export interface DocumentProviderOptions {
  // Injectable text engines, keyed by kind. Omitted entries keep the honest
  // "not wired up yet" default so nothing is ever hallucinated.
  extractors?: Partial<Record<FileBackedKind, ContentExtractor>>;
  // Optional idempotency store (sources lookup by content hash).
  store?: ContentStore;
}

export function documentProvider(opts: DocumentProviderOptions = {}): IngestionProvider {
  const extractors: Partial<Record<FileBackedKind, ContentExtractor>> = {
    pdf: makePdfExtractor(opts.extractors?.pdf),
    docx: makeDocxExtractor(opts.extractors?.docx),
    markdown: opts.extractors?.markdown ?? extractMarkdown
  };

  function kindOf(source: IngestSource): FileBackedKind | null {
    const kind = resolveFileKind(source.storage_path ?? "");
    return kind && (DOCUMENT_KINDS as readonly string[]).includes(kind) ? kind : null;
  }

  return {
    sourceTypes: ["transcript"],
    kinds: ["pdf", "docx", "markdown"],
    canHandle(source: IngestSource): boolean {
      return kindOf(source) !== null;
    },
    // Cheap extension pass at dispatch time; the storage-metadata pass happens
    // inside ingest once size + reported MIME are known.
    validate(source: IngestSource): IngestValidation {
      const result = validateFile({ fileName: baseName(source) });
      return toValidation(result);
    },
    ingest: async (source, ctx) => {
      const kind = kindOf(source);
      if (!kind) {
        throw ingestionFailure("This source isn't a PDF, DOCX or Markdown file.", {
          nextStep: "Upload a supported document type instead."
        });
      }
      const gated = await readAndValidateFile(ctx, source.storage_path ?? "", { textOnly: kind === "markdown" });
      const hash = opts.store ? contentHash(gated.bytes) : null;

      if (opts.store && hash) {
        const reuse = await findReusableSource(opts.store, source, kind, hash);
        if (reuse) {
          ctx.onProgress?.("Reusing existing content", 90);
          return {
            text: reuse.transcript,
            provider: "transcript_file",
            source: { type: "transcript", title: source.title ?? undefined }
          };
        }
      }

      ctx.onProgress?.("Extracting document", 60);
      let extracted;
      try {
        extracted = await extractors[kind]!({
          bytes: gated.bytes,
          fileName: gated.fileName,
          extension: (gated.fileName.split(".").pop() ?? "").toLowerCase(),
          mimeType: gated.mimeType
        });
      } catch (err) {
        if (isIngestionFailure(err)) throw err;
        throw ingestionFailure(`No transcript was produced from this ${kind.toUpperCase()} file.`, {
          why: toFailReason(err),
          nextStep:
            kind === "pdf"
              ? "PDF text extraction is coming soon — re-ingest once the pdf adapter is wired."
              : "Check the file is a valid document and re-ingest."
        });
      }
      ctx.onProgress?.("Ready", 100);
      if (opts.store && hash) await persistHashSafely(opts.store, source.id, hash);
      return ensureMeaningful(toCanonicalContent(extracted, source, { provider: "transcript_file" }));
    },
    normalize: ensureMeaningful
  };
}

function baseName(source: IngestSource): string {
  return (source.storage_path ?? "").split("/").pop() ?? "";
}

function toValidation(result: FileValidation): IngestValidation {
  return { ok: result.ok, errors: result.errors, kind: result.kind };
}
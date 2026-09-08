// Image intake adapter.
//
// An image is stored as a source asset and its understanding (OCR / vision) is
// deferred gracefully to a later "processing/analyzing" stage. The default
// extractor therefore FAILS with a human reason — the adapter never guesses at
// an image's contents, so no fabricated transcript is possible. Injecting a
// vision/OCR extractor through the seam turns this into a real ingester over
// the exact same canonical pipeline (normalize → TranscriptDocument).

import { resolveFileKind } from "./kinds";
import type { IngestSource } from "./types";
import type { IngestionProvider, IngestValidation } from "./registry";
import type { ContentExtractor } from "./extract";
import { makeImageExtractor } from "./extract";
import { toCanonicalContent, ensureMeaningful } from "./normalize";
import { findReusableSource, contentHash, type ContentStore } from "./idempotency";
import { readAndValidateFile } from "./file-gate";
import { ingestionFailure } from "./failure";
import { validateFile, type FileBackedKind } from "./kinds";

const KIND: FileBackedKind = "image";

export interface ImageProviderOptions {
  // Injectable vision/OCR extractor. The default defers analysis as a failed
  // lifecycle stage with an actionable reason.
  extractor?: ContentExtractor;
  store?: ContentStore;
}

export function imageProvider(opts: ImageProviderOptions = {}): IngestionProvider {
  const extractor = makeImageExtractor(opts.extractor);

  function isImage(source: IngestSource): boolean {
    return resolveFileKind(source.storage_path ?? "") === KIND;
  }

  return {
    sourceTypes: ["transcript"],
    kinds: ["image"],
    canHandle(source: IngestSource): boolean {
      return isImage(source);
    },
    validate(source: IngestSource): IngestValidation {
      const result = validateFile({ fileName: baseName(source) });
      return { ok: result.ok, errors: result.errors, kind: result.kind };
    },
    ingest: async (source, ctx) => {
      if (!isImage(source)) {
        throw ingestionFailure("This source isn't an image.", {
          nextStep: "Upload a supported image file instead."
        });
      }
      const gated = await readAndValidateFile(ctx, source.storage_path ?? "");

      if (opts.store) {
        const hash = contentHash(gated.bytes);
        const reuse = await findReusableSource(opts.store, source, KIND, hash);
        if (reuse) {
          ctx.onProgress?.("Reusing existing content", 90);
          return {
            text: reuse.transcript,
            provider: "transcript_file",
            source: { type: "transcript", title: source.title ?? undefined }
          };
        }
      }

      // The default extractor throws the deferral as an IngestionFailure; an
      // injected vision extractor returns real content which flows through the
      // same canonical pipeline.
      ctx.onProgress?.("Analyzing image", 60);
      let extracted;
      try {
        extracted = await extractor({
          bytes: gated.bytes,
          fileName: gated.fileName,
          extension: (gated.fileName.split(".").pop() ?? "").toLowerCase(),
          mimeType: gated.mimeType
        });
      } catch (err) {
        if (err instanceof Error) {
          throw ingestionFailure(
            "This image was stored as a source asset but has not been analyzed.",
            {
              why: "Image understanding (OCR/vision) is deferred to the processing/analyzing stage — this provider never assumes what an image contains.",
              nextStep: err.message
            }
          );
        }
        throw err;
      }

      ctx.onProgress?.("Ready", 100);
      return ensureMeaningful(toCanonicalContent(extracted, source, { provider: "transcript_file" }));
    },
    normalize: ensureMeaningful
  };
}

function baseName(source: IngestSource): string {
  return (source.storage_path ?? "").split("/").pop() ?? "";
}
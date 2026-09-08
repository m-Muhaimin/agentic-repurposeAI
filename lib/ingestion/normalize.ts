// Canonical normalization for extracted file content (pure).
//
// Turns an ExtractedContent into the canonical TranscriptDocument the worker
// downstreams expect — text + structure + metadata riding on the Phase-1
// canonical shape (which this phase extends with optional structure/metadata so
// document kinds aren't flattened to a bare text blob). Providers call this
// after extraction so the exact same shaping applies to pdf/docx/markdown and
// (when an OCR engine is injected) image kinds.

import type { IngestSource, TranscriptDocument } from "./types";
import type { ExtractedContent, ExtractedStructure, ExtractedMetadata } from "./extract";
import { ingestionFailure } from "./failure";

export interface CanonicalOptions {
  provider?: string;
}

export function toCanonicalContent(
  extracted: ExtractedContent,
  source: IngestSource,
  opts: CanonicalOptions = {}
): TranscriptDocument {
  const doc: TranscriptDocument = {
    text: extracted.text,
    provider: opts.provider ?? "transcript_file",
    source: {
      type: source.source_type,
      url: source.source_url ?? undefined,
      title: source.title ?? undefined
    },
    structure: extracted.structure ?? undefined,
    metadata: extracted.metadata ?? undefined
  };
  if (extracted.deferred) {
    doc.metadata = { ...(doc.metadata ?? {}), analysisDeferred: true };
  }
  return doc;
}

// For subtitle-like extracted content (segments already present) attach the
// same structure/metadata vocabulary without disturbing existing segments.
export function withExtractedStructure(
  doc: TranscriptDocument,
  structure: ExtractedStructure | null,
  metadata: ExtractedMetadata
): TranscriptDocument {
  return { ...doc, structure: structure ?? doc.structure, metadata: metadata };
}

// Guard used by document adapters: normalization must never ship an empty,
// non-deferred document (that would look fabricatable). Images deferring
// analysis legitimately carry empty text and pass.
export function ensureMeaningful(doc: TranscriptDocument): TranscriptDocument {
  if (!doc.text.trim() && !isDeferred(doc)) {
    throw ingestionFailure("Extracted content is empty — nothing to repurpose.", {
      nextStep: "Upload a document that contains text."
    });
  }
  return doc;
}

export function isDeferred(doc: TranscriptDocument): boolean {
  return doc.metadata?.analysisDeferred === true;
}
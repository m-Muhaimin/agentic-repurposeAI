// Phase 1 + Phase 2: explicit source registry + adapter interface.
//
// Replaces the type switch inside ingestSource with registered providers: a new
// intake mechanism is now a provider registration, not another case arm. The
// dispatch contract is unchanged (one entry point, one downstream
// TranscriptDocument) so the worker and every existing route keep working
// untouched.
//
// Phase 2 adds the file-backed intake taxonomy to the dispatch axis: a stored
// `transcript` row can actually be a PDF, DOCX, Markdown, image or subtitle
// file, so ingestSource first resolves the precise SourceKind from the source
// row (source_type + storage extension) then routes through the kind registry.
// Adapters expose canHandle/validate/ingest/normalize; everything stays mapped
// onto the DB enum via mapKindToSourceType — no kind can be registered the
// schema cannot store.

import type {
  IngestSource,
  IngestionContext,
  IngestionSourceType,
  TranscriptDocument
} from "./types";
import { resolveFileKind } from "./kinds";
import { ingestionFailure } from "./failure";
import { sourceKindForUrl } from "./url-classify";

// ── Source kinds: the full intake taxonomy ─────────────────────────────────
// `file`/`url` are generic intake verbs; concrete kinds (podcast feeds, PDFs,
// documents, images, subtitle/text files) fold onto the current DB enum only
// once a real intake path exists. Everything below does today.
export type SourceKind =
  | "file"
  | "url"
  | "youtube"
  | "podcast"
  | "audio"
  | "video"
  | "transcript"
  | "txt"
  | "srt"
  | "vtt"
  | "markdown"
  | "pdf"
  | "docx"
  | "image";

export function mapKindToSourceType(kind: SourceKind): IngestionSourceType | null {
  switch (kind) {
    case "youtube":
      return "youtube";
    case "audio":
      return "audio";
    case "video":
      return "video";
    // Every stored-file kind (plain text, subtitles, Markdown, PDF, DOCX,
    // image) rides the existing `transcript` source_type: the source_has_location
    // check covers storage_path-backed rows, so no enum migration is needed.
    case "transcript":
    case "txt":
    case "srt":
    case "vtt":
    case "markdown":
    case "pdf":
    case "docx":
    case "image":
      return "transcript";
    case "file":
    case "url":
    case "podcast":
      return null;
  }
}

// Sniff a `sources` row for its precise kind: media + YouTube map straight to
// their source type; a `transcript` row resolves by storage_path extension and
// falls back to the generic `transcript` kind when the extension isn't a known
// file kind (so legacy rows keep routing to the transcript provider). Phase 3:
// URL-backed rows (source_url set, no stored bytes) classify by URL content
// first so a web article, podcast feed, or YouTube link all reach their own
// adapter through the same seam. Rows that carry persisted bytes are untouched.
export function resolveKind(source: IngestSource): SourceKind | null {
  if (source.source_url && !source.storage_path) {
    const urlKind = sourceKindForUrl(source.source_url);
    if (urlKind) return urlKind;
  }
  switch (source.source_type) {
    case "youtube":
    case "audio":
    case "video":
      return source.source_type;
    case "transcript": {
      if (!source.storage_path) return "transcript";
      return resolveFileKind(source.storage_path) ?? "transcript";
    }
  }
}

// ── Adapter interface ──────────────────────────────────────────────────────

export interface IngestValidation {
  ok: boolean;
  // The file-backed kind matched (or null) — lets dispatch show per-kind errors.
  kind: SourceKind | null;
  errors: string[];
}

export interface IngestionProvider {
  // The source types this provider can ingest (a provider may serve several,
  // e.g. uploads cover audio + video).
  readonly sourceTypes: readonly IngestionSourceType[];
  // Concrete file kinds this provider handles; drives kind-level dispatch.
  readonly kinds?: readonly SourceKind[];
  // True when this provider should claim a row (used for same-type overlap,
  // e.g. several file providers sharing source_type 'transcript'). A provider
  // with no canHandle claims anything routed to it.
  canHandle?(source: IngestSource): boolean;
  // Cheap extension gate run at dispatch time, before any storage I/O.
  validate?(source: IngestSource): IngestValidation;
  ingest(source: IngestSource, ctx: IngestionContext): Promise<TranscriptDocument>;
  // Canonical shaping/guard pass over the produced document.
  normalize?(doc: TranscriptDocument): TranscriptDocument;
}

const registry = new Map<IngestionSourceType, IngestionProvider>();
const kindRegistry = new Map<SourceKind, IngestionProvider>();

export function registerIngestionProvider(provider: IngestionProvider): void {
  // First-wins per DB type keeps the original provider as the default for a
  // type even when file providers share 'transcript'.
  for (const type of provider.sourceTypes) {
    if (!registry.has(type)) registry.set(type, provider);
  }
  for (const kind of provider.kinds ?? []) {
    kindRegistry.set(kind, provider);
  }
}

export function providerFor(type: IngestionSourceType): IngestionProvider | null {
  return registry.get(type) ?? null;
}

export function providerForKind(kind: SourceKind): IngestionProvider | null {
  return kindRegistry.get(kind) ?? null;
}

export function getRegisteredSourceTypes(): IngestionSourceType[] {
  return [...registry.keys()];
}

export function getRegisteredKinds(): SourceKind[] {
  return [...kindRegistry.keys()];
}

// The one ingest entry point. Contract unchanged from the old switch — the
// worker keeps calling this and only this. Dispatch resolves the precise kind
// first (so a stored .pdf row routes to the pdf adapter, not the subtitle one),
// falls back to the source-type provider, then applies the provider's cheap
// validation before any real ingest work.
export async function ingestSource(
  source: IngestSource,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  const kind = resolveKind(source);
  const provider =
    kind !== null ? (providerForKind(kind) ?? providerFor(source.source_type)) : providerFor(source.source_type);
  if (!provider) {
    throw ingestionFailure(`Unsupported source type: ${source.source_type}`);
  }

  if (provider.validate) {
    const verdict = provider.validate(source);
    if (!verdict.ok) {
      throw ingestionFailure(verdict.errors.join(" "));
    }
  }

  const doc = await provider.ingest(source, ctx);
  return provider.normalize ? provider.normalize(doc) : doc;
}
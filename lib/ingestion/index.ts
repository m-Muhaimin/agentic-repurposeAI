// Ingestion layer entry point: turn any `sources` row into a canonical
// `TranscriptDocument`. The worker calls exactly one function; every source
// type (YouTube, uploaded media, transcript file, and the Phase-2 file kinds)
// resolves down to the same downstream contract.
//
// Phase 1: the type switch is replaced by the explicit registry in ./registry.
// Each real mechanism is registered as an adapter over the same interface, so a
// future intake kind is a new registration rather than a new case arm. Provider
// behaviour is unchanged — the three providers are exactly the bodies that used
// to sit behind the switch.
//
// Phase 2: the file-backed kinds (txt/srt/vtt/markdown/pdf/docx/image) are
// registered adapters over the same registry; ingestSource resolves the precise
// kind from the stored row so nothing about the worker entry point changes.

import { ingestYouTube } from "./youtube";
import { ingestUploadedMedia } from "./upload";
import { ingestTranscript } from "./transcript";
import { documentProvider } from "./document";
import { imageProvider } from "./image";
import { textFileProvider } from "./text-file";
import { urlProvider, ingestWebUrl, type UrlProviderOptions, type UrlExtractor } from "./url-adapter";
import { podcastProvider, ingestPodcastFeed, type PodcastProviderOptions } from "./podcast-adapter";
import { saveTranscript } from "./save";
import {
  ingestSource,
  registerIngestionProvider,
  providerFor,
  providerForKind,
  getRegisteredSourceTypes,
  getRegisteredKinds,
  mapKindToSourceType,
  resolveKind,
  type IngestionProvider,
  type SourceKind,
  type IngestValidation
} from "./registry";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";
import {
  provenanceOf,
  evidenceForQuote,
  evidenceForQuotes,
  isPinned
} from "./evidence";
import {
  stageToSourceStatus,
  stageToTranscriptStatus,
  sourceStatusToStage,
  transcriptStatusToStage,
  canTransition,
  STAGES_PER_SOURCE_TYPE
} from "./lifecycle";
import type { IngestionStage, StageReport } from "./lifecycle";
import type { TranscriptProvenance, Evidence, EvidenceMap } from "./evidence";
import {
  ingestionFailure,
  isIngestionFailure,
  toFailReason,
  buildFailReason,
  type IngestionFailure as IngestionFailureClass
} from "./failure";
import {
  contentHash,
  idempotencyKey,
  findReusableSource,
  type ContentStore,
  type ReuseResult
} from "./idempotency";
import {
  validateFile,
  resolveFileKind,
  kindForExtension,
  extensionsFor,
  maxBytesFor,
  isAllowedKindMime,
  assertTextualSample,
  KIND_RULES,
  type FileBackedKind,
  type FileValidation
} from "./kinds";
import { validateUrl, normalizeUrl, isPrivateHost, type UrlValidation } from "./url-validate";
import {
  classifySourceUrl,
  sourceKindForUrl,
  unsupportedMessage,
  socialLabel,
  type UrlClass
} from "./url-classify";
import {
  htmlToReadable,
  extractPageTitle,
  extractSiteName,
  decodeEntities,
  type ReadableContent
} from "./html-readable";
import {
  parseRssFeed,
  selectEpisode,
  parseDurationSeconds,
  normalizeFeedDate,
  type PodcastFeed,
  type PodcastEpisode,
  type EpisodeSelection
} from "./podcast-rss";
import {
  fetchUrl,
  feedContentType,
  htmlContentType,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_MAX_BYTES,
  type FetchedContent,
  type HttpOptions
} from "./url-fetch";
import {
  toCanonicalContent,
  ensureMeaningful,
  isDeferred,
  withExtractedStructure
} from "./normalize";
import {
  decodeText,
  detectStructure,
  extractPlainText,
  extractMarkdown,
  structureHeadings,
  makeExtractorSeam,
  makePdfExtractor,
  makeDocxExtractor,
  makeImageExtractor,
  type ContentExtractor,
  type ExtractInput,
  type ExtractedContent,
  type ExtractedStructure,
  type ExtractedMetadata,
  type ContentBlock,
  type ContentBlockType
} from "./extract";

export type {
  IngestSource,
  IngestionContext,
  TranscriptDocument,
  TranscriptSegment,
  IngestionSourceType,
  CanonicalContent
} from "./types";

export {
  saveTranscript,
  registerIngestionProvider,
  providerFor,
  providerForKind,
  getRegisteredSourceTypes,
  getRegisteredKinds,
  mapKindToSourceType,
  resolveKind,
  ingestSource,
  provenanceOf,
  evidenceForQuote,
  evidenceForQuotes,
  isPinned,
  stageToSourceStatus,
  stageToTranscriptStatus,
  sourceStatusToStage,
  transcriptStatusToStage,
  canTransition,
  ingestionFailure,
  isIngestionFailure,
  toFailReason,
  buildFailReason,
  contentHash,
  idempotencyKey,
  findReusableSource,
  validateFile,
  resolveFileKind,
  kindForExtension,
  extensionsFor,
  maxBytesFor,
  isAllowedKindMime,
  assertTextualSample,
  toCanonicalContent,
  ensureMeaningful,
  isDeferred,
  withExtractedStructure,
  structureHeadings,
  decodeText,
  detectStructure,
  extractPlainText,
  extractMarkdown,
  makeExtractorSeam,
  makePdfExtractor,
  makeDocxExtractor,
  makeImageExtractor,
  validateUrl,
  normalizeUrl,
  isPrivateHost,
  classifySourceUrl,
  sourceKindForUrl,
  unsupportedMessage,
  socialLabel,
  htmlToReadable,
  extractPageTitle,
  extractSiteName,
  decodeEntities,
  parseRssFeed,
  selectEpisode,
  parseDurationSeconds,
  normalizeFeedDate,
  fetchUrl,
  feedContentType,
  htmlContentType,
  urlProvider,
  podcastProvider,
  ingestWebUrl,
  ingestPodcastFeed,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_MAX_BYTES
};
export type {
  IngestionProvider,
  SourceKind,
  IngestValidation,
  TranscriptProvenance,
  Evidence,
  EvidenceMap,
  IngestionStage,
  StageReport,
  FileBackedKind,
  FileValidation,
  ContentExtractor,
  ExtractInput,
  ExtractedContent,
  ExtractedStructure,
  ExtractedMetadata,
  ContentBlock,
  ContentBlockType,
  ContentStore,
  ReuseResult,
  IngestionFailureClass as IngestionFailure,
  UrlValidation,
  UrlClass,
  ReadableContent,
  PodcastFeed,
  PodcastEpisode,
  EpisodeSelection,
  FetchedContent,
  HttpOptions,
  UrlProviderOptions,
  UrlExtractor,
  PodcastProviderOptions
};
export { STAGES_PER_SOURCE_TYPE, KIND_RULES };

// The real intake mechanisms, registered once at module load. Their internal
// guards (source_type / storage_path / source_url checks) stay where they are;
// the registry only decides which adapter handles a source row.
registerIngestionProvider({ sourceTypes: ["youtube"], kinds: ["youtube"], ingest: ingestYouTube });
registerIngestionProvider({ sourceTypes: ["audio", "video"], kinds: ["audio", "video"], ingest: ingestUploadedMedia });
// Text + subtitle files keep the original transcript provider behind a
// per-kind gateway; documents and images get dedicated adapters. All of them
// share source_type 'transcript' (first-wins in the registry keeps the
// original provider as the type default; kind dispatch does the real routing).
registerIngestionProvider(textFileProvider());
registerIngestionProvider(documentProvider());
registerIngestionProvider(imageProvider());
// Phase 3: URL + podcast intake. Both dispatch on URL content (kind 'url' /
// 'podcast') and have no DB source_type of their own yet — the schema can't
// persist a location-less URL row until a future migration relaxes
// source_has_location, so these light up for stored rows that carry one.
registerIngestionProvider(urlProvider());
registerIngestionProvider(podcastProvider());
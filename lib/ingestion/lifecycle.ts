// Canonical ingestion lifecycle (pure).
//
// Every source that enters the system moves through the same stage vocabulary,
// independent of which provider handles it (YouTube captions vs yt-dlp vs
// uploaded media vs a pasted transcript file). This module is the single
// definition of that vocabulary and of how stages map onto the existing
// `sources.status` / `transcripts.status` enum values — the worker keeps
// writing those enums unchanged; this model just lets providers describe
// progress and lets UI render a source's stage without a per-provider switch.
//
// No I/O, no Supabase — unit-testable in isolation.

import type { IngestionSourceType } from "./types";

// The canonical lifecycle stages. Named after what the system is *doing to the
// content*, not after which provider is doing it.
export type IngestionStage =
  | "initiated" //      source row created; nothing claimed it yet
  | "retrieving" //     pulling source bytes (storage download, yt-dlp, ATC)
  | "ingesting" //      cleaning/normalizing content (captions parse, gates)
  | "transcribing" //   running transcription (AssemblyAI)
  | "producing" //      assembling the CanonicalContent (segments, speaker tags)
  | "ready" //          canonical transcript durable and usable downstream
  | "failed";

// Where the worker currently writes progress. Kept in lockstep with the
// `sources.status` enum in types/supabase.ts.
export type SourceStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "generating"
  | "done"
  | "failed";

// Where `transcripts.status` currently lives (types/supabase.ts).
export type TranscriptStatus = "processing" | "ready" | "failed";

// Canonical stage ⇄ persisted source status. `retrieving`/`ingesting`/`producing`
// are sub-stages of `sources.status = 'transcribing'` (one worker transition);
// `initiated` is the default at row creation.
export function stageToSourceStatus(stage: IngestionStage): SourceStatus {
  switch (stage) {
    case "initiated":
    case "retrieving":
    case "ingesting":
    case "transcribing":
    case "producing":
      return "transcribing";
    case "ready":
      return "transcribed";
    case "failed":
      return "failed";
  }
}

// Canonical stage ⇄ persisted transcript status. A transcript only exists once
// producing finishes, so pre-production stages map to 'processing' even though
// the row isn't written yet — the mapping is what saveTranscript will use.
export function stageToTranscriptStatus(stage: IngestionStage): TranscriptStatus {
  switch (stage) {
    case "initiated":
    case "retrieving":
    case "ingesting":
    case "transcribing":
    case "producing":
      return "processing";
    case "ready":
      return "ready";
    case "failed":
      return "failed";
  }
}

// Reverse mapping: what canonical stage is a persisted source at? This lets
// existing rows (from before the model existed) be rendered in stage terms.
export function sourceStatusToStage(status: SourceStatus): IngestionStage {
  switch (status) {
    case "uploaded":
      return "initiated";
    case "transcribing":
      return "transcribing";
    case "transcribed":
      return "ready";
    case "generating":
    case "done":
      return "ready";
    case "failed":
      return "failed";
  }
}

// Reverse mapping for transcripts.
export function transcriptStatusToStage(status: TranscriptStatus): IngestionStage {
  switch (status) {
    case "processing":
      return "transcribing";
    case "ready":
      return "ready";
    case "failed":
      return "failed";
  }
}

// Valid stage transitions. The worker moves a source through the chain in
// order; 'failed' is reachable from any active stage. Guards against a provider
// accidentally skipping or regressing a stage.
export function canTransition(from: IngestionStage, to: IngestionStage): boolean {
  if (from === to) return false;
  if (to === "failed") return from !== "failed";
  if (from === "failed") return false;
  const ORDER: IngestionStage[] = [
    "initiated",
    "retrieving",
    "ingesting",
    "transcribing",
    "producing",
    "ready"
  ];
  return ORDER.indexOf(to) > ORDER.indexOf(from);
}

// The provider contract for describing progress. Returns the canonical stage
// after this step, which the worker may map back to source/transcript status
// via the helpers above. A provider may skip stages it doesn't perform.
export interface StageReport {
  stage: IngestionStage;
  sourceType: IngestionSourceType;
}

// Per-kind metadata: which stages a provider of a given source type can be
// expected to pass through. Used for honest UI ("transcribing" only makes
// sense for audio-via-ASR paths) and as documentation for future intake kinds.
export const STAGES_PER_SOURCE_TYPE: Record<IngestionSourceType, readonly IngestionStage[]> = {
  youtube: ["retrieving", "ingesting", "producing", "ready"],
  audio: ["retrieving", "transcribing", "producing", "ready"],
  video: ["retrieving", "transcribing", "producing", "ready"],
  transcript: ["ingesting", "producing", "ready"]
};
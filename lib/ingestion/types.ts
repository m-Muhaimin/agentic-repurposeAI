// Canonical ingestion contract — the one type every input mechanism produces.
//
// The worker (`/api/process`) never needs to know whether a source came from a
// YouTube captions track, an uploaded MP4, or a pasted SRT file: it calls
// `ingestSource()` and gets a `TranscriptDocument`. Everything downstream
// (generation, persistence) is source-agnostic from that point.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type IngestionSourceType = "youtube" | "audio" | "video" | "transcript";

// Structural view of a `sources` row that ingestion providers depend on — kept
// deliberately minimal so providers don't reach into the rest of the row.
export interface IngestSource {
  id: string;
  user_id: string;
  source_type: IngestionSourceType;
  title: string | null;
  source_url: string | null;
  storage_path: string | null;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

export interface TranscriptDocument {
  text: string;
  segments?: TranscriptSegment[];
  language?: string;
  durationSeconds?: number;
  // Which mechanism produced the transcript and (where available) the id of the
  // underlying transcript record (AssemblyAI transcript id, YouTube caption id).
  provider?: string;
  providerTranscriptId?: string;
  source: {
    type: IngestionSourceType;
    url?: string;
    title?: string;
    author?: string;
    authorId?: string;
  };
}

// Per-invocation context handed to every ingestX() provider: the service-role
// Supabase client (storage + privileged db writes, e.g. persisting a pulled
// storage_path) and an optional progress callback so the worker can stream
// stage/pct events back to the dashboard.
export interface IngestionContext {
  service: SupabaseClient<Database>;
  onProgress?: (stage: string, pct: number) => void;
}
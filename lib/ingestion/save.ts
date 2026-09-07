// Persist the result of ingestSource() to the canonical transcripts table.
// The worker writes this after a successful ingestion so the final transcript
// outlives the in-memory job run — independently of the (denormalised)
// `sources.transcript` text column.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestSource, TranscriptDocument } from "./types";

const TRANSCRIPT_PROVIDERS = ["assemblyai", "youtube_captions", "transcript_file"] as const;
type TranscriptProvider = (typeof TRANSCRIPT_PROVIDERS)[number];

// Missing-table degradation matches the rest of the codebase (see user_prompts,
// the formats column): if the migration hasn't been applied the worker keeps
// going — the transcript still lands in sources.transcript. Returns false in
// that case so callers can log it.
export async function saveTranscript(
  supabase: SupabaseClient,
  source: IngestSource,
  doc: TranscriptDocument
): Promise<boolean> {
  const provider = TRANSCRIPT_PROVIDERS.find((p) => p === doc.provider) ?? "transcript_file";
  const { error } = await supabase.from("transcripts").upsert(
    {
      user_id: source.user_id,
      source_id: source.id,
      provider,
      language: doc.language ?? null,
      duration_seconds: doc.durationSeconds ?? null,
      status: "ready",
      content: doc.text,
      error_message: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "source_id" }
  );
  if (!error) return true;
  if (/could not find|does\s*n?o?t?\s*exist|PGRST205|42P01/i.test(error.message)) return false;
  throw new Error(`Could not save transcript: ${error.message}`);
}
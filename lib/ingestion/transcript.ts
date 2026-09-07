// Stored transcript file → TranscriptDocument. Supports plain text (.txt) and
// subtitle files (.srt/.vtt). Source-agnostic like the other providers — the
// worker only sees the resulting TranscriptDocument.

import { fileExtension } from "@/lib/limits";
import { looksLikeSubtitles, parseSrt, parseVtt, segmentsToText } from "@/lib/captions";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";

const TRANSCRIPT_EXTENSIONS = ["txt", "srt", "vtt"] as const;

export async function ingestTranscript(
  source: IngestSource,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  if (source.source_type !== "transcript") throw new Error("Not a transcript source.");
  if (!source.storage_path) throw new Error("Transcript source has no file to read.");

  const ext = fileExtension(source.storage_path);
  if (!(TRANSCRIPT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(`Unsupported transcript file type: .${ext}`);
  }

  ctx.onProgress?.("Reading transcript", 30);
  const { data: blob, error } = await ctx.service.storage
    .from("sources")
    .download(source.storage_path);
  if (error) throw new Error(`Could not download transcript file: ${error.message}`);
  const raw = (await blob.text()).trim();
  if (!raw) throw new Error("The transcript file is empty.");

  ctx.onProgress?.("Parsing transcript", 60);

  // SRT/VTT files parse straight through. A .txt that only _looks_ like
  // subtitles gets parsed too — saves the user from a "wrong extension" roundtrip.
  const subtitleText =
    ext === "srt" || ext === "vtt" || (ext === "txt" && looksLikeSubtitles(raw));

  if (subtitleText) {
    const useVtt = ext === "vtt" || (ext === "txt" && raw.startsWith("WEBVTT"));
    const segments = useVtt ? parseVtt(raw) : parseSrt(raw);
    if (segments.length === 0) throw new Error("No caption cues found in the transcript file.");
    return {
      text: segmentsToText(segments),
      segments,
      provider: "transcript_file",
      source: { type: "transcript", title: source.title ?? undefined }
    };
  }

  // Plain text: one block, no timestamps.
  return {
    text: raw,
    provider: "transcript_file",
    source: { type: "transcript", title: source.title ?? undefined }
  };
}
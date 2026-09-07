// Uploaded media → TranscriptDocument via AssemblyAI. Extracts the size/MIME
// gates and signed-URL plumbing previously inlined in the worker, so the
// transcription path for uploads lives behind the same ingestion seam as
// YouTube and transcript files.

import {
  MAX_SOURCE_FILE_BYTES,
  MAX_SOURCE_FILE_MB,
  SOURCE_FILE_EXTENSIONS,
  isAllowedSourceExtension,
  isAllowedSourceMime
} from "@/lib/limits";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { createSignedUrl } from "./storage";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";

export async function ingestUploadedMedia(
  source: IngestSource,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  if (source.source_type !== "audio" && source.source_type !== "video") {
    throw new Error("Not an audio/video source.");
  }
  if (!source.storage_path) throw new Error("Source has no audio file to transcribe.");

  // File upload: gate size + reported MIME before spending transcription
  // quota. Magic-byte sniffing isn't worth the egress here — a strict extension
  // allowlist plus the stored object's own metadata blocks obvious abuse, and
  // AssemblyAI rejects garbage anyway.
  ctx.onProgress?.("Preparing audio", 42);
  const { data: obj, error: infoErr } = await ctx.service.storage
    .from("sources")
    .info(source.storage_path);
  if (infoErr) throw new Error(`Could not read uploaded file metadata: ${infoErr.message}`);
  const meta = (obj?.metadata ?? {}) as Record<string, unknown>;
  const size = Number(meta.size ?? meta.contentLength ?? 0);
  if (size > MAX_SOURCE_FILE_BYTES) {
    throw new Error(`This file is larger than the ${MAX_SOURCE_FILE_MB} MB limit.`);
  }
  if (!isAllowedSourceExtension(source.storage_path)) {
    throw new Error(`Unsupported file type. Allowed: ${SOURCE_FILE_EXTENSIONS.join(", ")}`);
  }
  if (!isAllowedSourceMime(String(meta.mimetype ?? ""))) {
    throw new Error("The uploaded file doesn't look like audio or video.");
  }

  const signedUrl = await createSignedUrl(ctx, source.storage_path);
  const text = await transcribeAudio(signedUrl, (pct) =>
    ctx.onProgress?.("Transcribing audio", pct)
  );

  return {
    text,
    provider: "assemblyai",
    source: {
      type: source.source_type,
      title: source.title ?? undefined
    }
  };
}
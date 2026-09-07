// YouTube URL → TranscriptDocument.
//
// Two mechanisms behind the same seam:
//  - OAuth captions (connected channel): pull the video's own caption track via
//    the YouTube Data API — no download, no async transcription, no yt-dlp.
//    Requires the user to have connected their channel.
//  - Legacy fallback: yt-dlp probe → download mp3 → storage → AssemblyAI.
//    Covers videos without captions and users who haven't connected. A later
//    commit retires this from the production flow once OAuth is mandatory.

import { describeYoutubeError, downloadYoutubeMp3, fetchVideoInfo } from "@/lib/ingestion/providers/ytdlp";
import { MAX_INPUT_SECONDS, MAX_INPUT_MINUTES } from "@/lib/limits";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { log } from "@/lib/logger";
import { getYoutubeVideoIdOrThrow } from "@/lib/youtube-url";
import {
  downloadCaption,
  fetchCaptionTracks,
  fetchVideoSnippet,
  GoogleApiError,
  type CaptionTrack
} from "@/lib/youtube/client";
import { parseSrt, segmentsToText } from "@/lib/captions";
import { deleteConnection, getValidAccessToken } from "@/lib/youtube/connections";
import { createSignedUrl } from "./storage";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";

export async function ingestYouTube(
  source: IngestSource,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  if (source.source_type !== "youtube") throw new Error("Not a YouTube source.");
  if (!source.source_url) throw new Error("Missing source_url for youtube source.");

  const viaCaptions = await tryIngestViaCaptions(source, source.source_url, ctx);
  if (viaCaptions) return viaCaptions;

  return ingestYouTubeLegacy(source, source.source_url, ctx);
}

// Returns a TranscriptDocument when the connected user's channel owns (or has
// captions for) the video, otherwise null so the caller can fall back. Non-fatal
// failures log and fall back too — the caption path must never be the thing that
// fails a job while the legacy path still works.
async function tryIngestViaCaptions(
  source: IngestSource,
  url: string,
  ctx: IngestionContext
): Promise<TranscriptDocument | null> {
  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken(source.user_id);
  } catch (err) {
    if (err instanceof GoogleApiError && err.reason === "invalid_grant") {
      log.warn("ingest.youtube_connection_revoked", {
        source_id: source.id,
        user_id: source.user_id
      });
      await deleteConnection(source.user_id).catch(() => {});
    } else {
      log.warn("ingest.youtube_oauth_unavailable", {
        source_id: source.id,
        user_id: source.user_id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
    return null;
  }
  if (!accessToken) return null;

  try {
    const videoId = getYoutubeVideoIdOrThrow(url);
    ctx.onProgress?.("Fetching YouTube captions", 12);
    const tracks = await fetchCaptionTracks(accessToken, videoId);
    const track = pickCaptionTrack(tracks);
    if (!track) {
      log.info("ingest.youtube_no_captions", { source_id: source.id, user_id: source.user_id });
      return null;
    }

    ctx.onProgress?.("Fetching YouTube captions", 38);
    const srt = await downloadCaption(accessToken, track.id);
    const segments = parseSrt(srt);
    if (segments.length === 0) {
      log.info("ingest.youtube_empty_captions", {
        source_id: source.id,
        user_id: source.user_id
      });
      return null;
    }
    ctx.onProgress?.("Parsing captions", 55);

    // Best-effort author info; the title fallback keeps the source row's title
    // when the API call fails (private/age-gated videos may 403 here).
    const snippet = await fetchVideoSnippet(accessToken, videoId).catch(() => null);

    const doc: TranscriptDocument = {
      text: segmentsToText(segments),
      segments,
      language: track.language ?? undefined,
      durationSeconds: Math.max(0, Math.round(segments[segments.length - 1].endMs / 1000)),
      provider: "youtube_captions",
      providerTranscriptId: track.id,
      source: {
        type: "youtube",
        url,
        title: snippet?.title || (source.title ?? undefined),
        author: snippet?.channelTitle,
        authorId: snippet?.channelId
      }
    };
    log.info("ingest.youtube_captions", {
      source_id: source.id,
      user_id: source.user_id,
      caption_id: track.id,
      segments: segments.length
    });
    return doc;
  } catch (err) {
    // 403 = captions not available to this app (some ASR tracks are restricted);
    // anything else shouldn't kill the job while the legacy path exists.
    log.warn("ingest.youtube_captions_failed", {
      source_id: source.id,
      user_id: source.user_id,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

// Prefer a human-uploaded track (standard/forced) over YouTube's auto-generated
// ASR — ASR reads worse and sometimes can't be downloaded at all.
function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  return tracks.find((t) => t.trackKind !== "asr") ?? tracks[0];
}

// Legacy v1 path: probe → download mp3 → storage → AssemblyAI, exactly as the
// worker used to inline it. Kept until the OAuth captions path (or transcript
// files) fully replaces it.
async function ingestYouTubeLegacy(
  source: IngestSource,
  url: string,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  let storagePath = source.storage_path;

  if (!storagePath) {
    // Probe before the heavy download: reject private/unavailable or over-limit
    // videos here with a clear error instead of after pulling the whole file.
    // Skipped on retries where storage_path already exists from a prior run.
    let videoInfo;
    try {
      videoInfo = await fetchVideoInfo(url);
    } catch (err) {
      throw new Error(describeYoutubeError(err instanceof Error ? err.message : String(err)));
    }
    if (videoInfo.duration > MAX_INPUT_SECONDS) {
      throw new Error(
        `This video is ${Math.round(videoInfo.duration / 60)} min long — ` +
          `longer than the ${MAX_INPUT_MINUTES}-minute limit.`
      );
    }

    const { buffer, filename } = await downloadYoutubeMp3(url);
    ctx.onProgress?.("Fetching YouTube content", 34);

    storagePath = `${source.user_id}/youtube/${Date.now()}-${filename}`;
    const { error: uploadError } = await ctx.service.storage
      .from("sources")
      .upload(storagePath, buffer, { contentType: "audio/mpeg" });
    if (uploadError) throw new Error(`Could not store pulled audio: ${uploadError.message}`);
    await ctx.service.from("sources").update({ storage_path: storagePath }).eq("id", source.id);
  }
  ctx.onProgress?.("Fetching YouTube content", 42);

  const signedUrl = await createSignedUrl(ctx, storagePath);
  const text = await transcribeAudio(signedUrl, (pct) =>
    ctx.onProgress?.("Transcribing audio", pct)
  );

  return {
    text,
    provider: "assemblyai",
    source: {
      type: "youtube",
      url,
      title: source.title ?? undefined
    }
  };
}
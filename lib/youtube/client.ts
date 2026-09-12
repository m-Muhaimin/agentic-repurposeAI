// YouTube Data API v3 calls, authenticated as the connected user (server-only).
// No SDK: a small set of fetch calls over Bearer tokens. Every call throws
// GoogleApiError on non-2xx with the API's own message + reason, so the ingestion
// provider can decide whether to fall back to the legacy pull path.

const API = "https://www.googleapis.com/youtube/v3";

// Wall-clock cap on a single YouTube Data API call so a hung provider can't
// hang the request (ARCHITECTURE_FREEZE §3 bounded I/O).
const FETCH_TIMEOUT_MS = 10_000;

export class GoogleApiError extends Error {
  status: number;
  reason?: string;
  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.reason = reason;
  }
}

export interface YoutubeChannel {
  channelId: string;
  channelTitle: string;
  uploadsPlaylistId: string;
}

export interface CaptionTrack {
  id: string;
  language: string | null;
  name: string | null;
  trackKind: "standard" | "asr" | "forced" | null;
  isAutosynced?: boolean;
  isCC?: boolean;
}

export interface VideoSnippet {
  videoId: string;
  title: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnail?: string | null;
}

async function getJson(path: string, accessToken: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    });
  } catch (err) {
    throw failFromTransport(err, "request");
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const e = (data?.error ?? {}) as Record<string, unknown>;
    const reasons = Array.isArray(e.errors) ? (e.errors as Array<Record<string, unknown>>) : [];
    throw new GoogleApiError(
      (typeof e.message === "string" && e.message) || `YouTube API request failed (${res.status}).`,
      res.status,
      typeof reasons[0]?.reason === "string" ? reasons[0].reason : undefined
    );
  }
  return data;
}

export async function fetchMyChannel(accessToken: string): Promise<YoutubeChannel> {
  const data = await getJson("/channels?part=snippet,contentDetails&mine=true", accessToken);
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  const it = items[0];
  if (!it) throw new GoogleApiError("No YouTube channel found for this account.", 404);
  const cd = (it.contentDetails ?? {}) as Record<string, unknown>;
  const related = (cd.relatedPlaylists ?? {}) as Record<string, unknown>;
  const uploads = typeof related.uploads === "string" ? related.uploads : "";
  if (!uploads) throw new GoogleApiError("Channel has no uploads playlist.", 404);
  return {
    channelId: String(it.id),
    channelTitle: String(((it.snippet ?? {}) as Record<string, unknown>).title ?? it.id),
    uploadsPlaylistId: uploads
  };
}

export async function fetchUploads(
  accessToken: string,
  playlistId: string,
  maxResults = 25
): Promise<VideoSnippet[]> {
  const q = new URLSearchParams({ part: "snippet", playlistId, maxResults: String(maxResults) });
  const data = await getJson(`/playlistItems?${q.toString()}`, accessToken);
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  const videos: VideoSnippet[] = [];
  for (const item of items) {
    const sn = (item.snippet ?? {}) as Record<string, unknown>;
    const rid = (sn.resourceId ?? {}) as Record<string, unknown>;
    const videoId = typeof rid.videoId === "string" ? rid.videoId : "";
    if (!videoId) continue;
    const thumbs = (sn.thumbnails ?? {}) as Record<string, unknown>;
    const def = (thumbs.default ?? {}) as Record<string, unknown>;
    videos.push({
      videoId,
      title: typeof sn.title === "string" ? sn.title : "Untitled",
      publishedAt: typeof sn.publishedAt === "string" ? sn.publishedAt : undefined,
      thumbnail: typeof def.url === "string" ? def.url : null
    });
  }
  return videos;
}

export async function fetchVideoSnippet(
  accessToken: string,
  videoId: string
): Promise<VideoSnippet | null> {
  const data = await getJson(`/videos?part=snippet&id=${videoId}`, accessToken);
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  const it = items[0];
  if (!it) return null;
  const sn = (it.snippet ?? {}) as Record<string, unknown>;
  return {
    videoId,
    title: typeof sn.title === "string" ? sn.title : "Untitled",
    channelId: typeof sn.channelId === "string" ? sn.channelId : undefined,
    channelTitle: typeof sn.channelTitle === "string" ? sn.channelTitle : undefined
  };
}

export async function fetchCaptionTracks(
  accessToken: string,
  videoId: string
): Promise<CaptionTrack[]> {
  const q = new URLSearchParams({ part: "snippet", videoId });
  const data = await getJson(`/captions?${q.toString()}`, accessToken);
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  const tracks: CaptionTrack[] = [];
  for (const item of items) {
    const sn = (item.snippet ?? {}) as Record<string, unknown>;
    const kind = sn.trackKind;
    tracks.push({
      id: String(item.id),
      language: typeof sn.language === "string" ? sn.language : null,
      name: typeof sn.name === "string" ? sn.name : null,
      trackKind: kind === "standard" || kind === "asr" || kind === "forced" ? kind : null,
      isAutosynced: sn.isAutoSynced === true,
      isCC: sn.isCC === true
    });
  }
  return tracks;
}

export async function downloadCaption(accessToken: string, captionId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}/captions/${captionId}?tfmt=srt`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    });
  } catch (err) {
    throw failFromTransport(err, "caption download");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const e = (data?.error ?? {}) as Record<string, unknown>;
    const reasons = Array.isArray(e.errors) ? (e.errors as Array<Record<string, unknown>>) : [];
    throw new GoogleApiError(
      (typeof e.message === "string" && e.message) || `Caption download failed (${res.status}).`,
      res.status,
      typeof reasons[0]?.reason === "string" ? reasons[0].reason : undefined
    );
  }
  return res.text();
}

// Transport-level failures reject with raw DOM/Type errors; surface a timeout
// abort as the lib's typed GoogleApiError so callers never see a raw
// AbortError — all other failures keep their current shape.
function failFromTransport(err: unknown, what: string): never {
  if (err instanceof Error && err.name === "AbortError") {
    throw new GoogleApiError(`YouTube API ${what} timed out.`, 408, "timeout");
  }
  throw err;
}
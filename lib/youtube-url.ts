// Pure URL parser/validator for YouTube links — no Node-only imports, so it can
// be used from client components (app/upload) and server code (lib/yt-dlp.ts)
// alike. Rejects channel/playlist/`list=`-only links and malformed video ids.

const HOST_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function getYoutubeVideoId(url: string): string | null {
  const u = String(url).trim();
  if (!HOST_RE.test(u)) return null;

  // youtu.be/{id} (optionally followed by ?t=, &list= etc.)
  let m = u.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&#].*)?$/i
  );
  if (m) return m[1];

  // youtube.com/watch?v={id}, /shorts/{id}, /embed/{id}, /live/{id}
  m = u.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/i
  );
  if (m) return m[1];

  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return getYoutubeVideoId(url) !== null;
}

export function getYoutubeVideoIdOrThrow(url: string): string {
  const id = getYoutubeVideoId(url);
  if (!id) throw new Error("That URL doesn't point to a single YouTube video.");
  return id;
}

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID_RE.test(value);
}
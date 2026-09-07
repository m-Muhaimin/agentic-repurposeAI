// Input limits shared by the client upload form and the server worker. Pure
// module (no Node imports) so client components can read the same defaults.
// Server-only env overrides make the caps tunable per environment.

export const SOURCE_FILE_EXTENSIONS = [
  "mp3",
  "m4a",
  "m4b",
  "wav",
  "aiff",
  "aac",
  "ogg",
  "flac",
  "webm",
  "mp4",
  "mov",
  "mpeg",
  "mpg"
] as const;

// Transcript sources: plain text or subtitle files, parsed by the transcript
// ingestion provider instead of being transcribed.
export const TRANSCRIPT_FILE_EXTENSIONS = ["txt", "srt", "vtt"] as const;

// Manual file uploads: soft cap is enforced client-side before upload and
// server-side in the worker before any AssemblyAI/Gemini spend. YouTube path
// uses the same cap on the pulled mp3.
export const MAX_SOURCE_FILE_BYTES = readMaxFileBytes();
export const MAX_SOURCE_FILE_MB = Math.round(MAX_SOURCE_FILE_BYTES / (1024 * 1024));

// Longest accepted recording (seconds). Currently enforced on the YouTube path,
// where the worker probes the video before downloading; manual uploads can't be
// probed without downloading them first.
export const MAX_INPUT_SECONDS = readMaxInputSeconds();
export const MAX_INPUT_MINUTES = Math.max(1, Math.round(MAX_INPUT_SECONDS / 60));

// Enqueues per user per rolling minute on /api/repurpose (drives paid APIs).
export const REPURPOSE_RATE_LIMIT_PER_MIN = readRateLimit();

function readMaxFileBytes(): number {
  const n = num(process.env.MAX_SOURCE_FILE_MB);
  return Number.isFinite(n) && n > 0 ? n * 1024 * 1024 : 200 * 1024 * 1024;
}

function readMaxInputSeconds(): number {
  const n = num(process.env.MAX_INPUT_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 2 * 60 * 60;
}

function readRateLimit(): number {
  const n = num(process.env.REPURPOSE_RATE_LIMIT_PER_MIN);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

function num(raw: string | undefined): number {
  return raw ? Number(raw) : NaN;
}

export function fileExtension(name: string): string {
  const idx = String(name).lastIndexOf(".");
  return idx >= 0 ? String(name).slice(idx + 1).toLowerCase() : "";
}

export function isAllowedSourceExtension(name: string): boolean {
  return (SOURCE_FILE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function isAllowedTranscriptExtension(name: string): boolean {
  return (TRANSCRIPT_FILE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function isAllowedSourceMime(mime: string | null | undefined): boolean {
  // Unknown (browser reported none) is allowed through — the extension gate
  // still applies — but anything that claims to be non-media is rejected.
  if (!mime) return true;
  return /^(audio|video)\//i.test(mime);
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 100 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}
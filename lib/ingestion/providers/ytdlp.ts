// Legacy YouTube pull via yt-dlp — archived under ingestion/providers as the
// fallback path (it has no production shipping route since the cookie-sync
// extension was retired; OAuth captions and transcript uploads are the primary
// mechanisms). Flow: validate URL -> download bestaudio -> extract mp3 (ffmpeg).
// The mp3 is then uploaded to Supabase storage and transcribed with AssemblyAI,
// exactly like a manual audio upload — no Gemini involved for ingestion.
//
// Prerequisites: yt-dlp and ffmpeg on PATH. YTDLP_JS_RUNTIME can force a JS
// runtime (e.g. "node"); newer yt-dlp needs one of them for YouTube and picks
// its own default otherwise.

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { MAX_SOURCE_FILE_BYTES, MAX_SOURCE_FILE_MB } from "@/lib/limits";

const JS_RUNTIME = process.env.YTDLP_JS_RUNTIME;
const DOWNLOAD_TIMEOUT_MS = parseInt(
  process.env.YTDLP_DOWNLOAD_TIMEOUT_MS || "600000",
  10
);

// Maps raw yt-dlp stderr/messages onto user-facing errors, so private or
// restricted videos fail with a clear message instead of a cryptic yt-dlp dump.
export function describeYoutubeError(raw: string): string {
  const msg = String(raw ?? "");
  if (/This video is private|Private video/i.test(msg))
    return "This video is private — only public videos can be repurposed.";
  if (/Video unavailable|is not available|Unavailable/i.test(msg))
    return "Video is unavailable (removed, age-restricted, or region-locked).";
  if (/Sign in to confirm|confirm your age|Log in to confirm|login required/i.test(msg))
    return "YouTube is asking for sign-in on this video. Connect your channel or pick a different video.";
  if (/No video ids|No video ID|Unable to download webpage|404/i.test(msg))
    return "That YouTube URL is malformed or the video doesn't exist.";
  if (/premium feature|YouTube Music/i.test(msg))
    return "This link isn't a regular YouTube video.";
  return msg;
}

export function runYtDlp(
  args: string[],
  { timeoutMs = 60000 }: { timeoutMs?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const base: string[] = [];
    if (JS_RUNTIME) base.push("--js-runtimes", JS_RUNTIME);

    const child = spawn("yt-dlp", [...base, ...args]);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      else resolve(stdout);
    });
  });
}

export type VideoInfo = {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: Array<{
    format_id: string;
    ext: string;
    resolution: string | null;
    fps: number | null;
    note: string;
    vcodec: string;
    acodec: string;
    abr: number | null;
    filesize: number | null;
    type: "video+audio" | "video-only" | "audio-only";
  }>;
};

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const out = await runYtDlp(["-j", "--no-playlist", url], { timeoutMs: 30000 });
  const data = JSON.parse(out) as {
    title?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
    formats?: Array<Record<string, unknown>>;
  };

  const formats = (data.formats ?? [])
    .filter((f) => f.vcodec !== "none" || f.acodec !== "none")
    .map((f) => {
      const vcodec = String(f.vcodec ?? "none");
      const acodec = String(f.acodec ?? "none");
      const isVideo = vcodec !== "none";
      return {
        format_id: String(f.format_id ?? ""),
        ext: String(f.ext ?? ""),
        resolution:
          isVideo && (f.resolution || f.width || f.height)
            ? String(f.resolution || `${f.width || "?"}x${f.height || "?"}`)
            : null,
        fps: typeof f.fps === "number" ? f.fps : null,
        note: String(f.format_note ?? ""),
        vcodec,
        acodec,
        abr: typeof f.abr === "number" ? f.abr : null,
        filesize:
          typeof f.filesize === "number"
            ? f.filesize
            : typeof f.filesize_approx === "number"
              ? f.filesize_approx
              : null,
        type: (isVideo && acodec !== "none" ? "video+audio" : isVideo ? "video-only" : "audio-only") as VideoInfo["formats"][number]["type"]
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { "video+audio": 0, "video-only": 1, "audio-only": 2 };
      return order[a.type] - order[b.type];
    });

  return {
    title: data.title ?? "",
    thumbnail: data.thumbnail ?? "",
    duration: data.duration ?? 0,
    uploader: data.uploader ?? "",
    formats
  };
}

// Downloads the best audio stream and extracts it as mp3 into a temp dir, then
// reads the file and cleans up.
export async function downloadYoutubeMp3(
  url: string
): Promise<{ buffer: Buffer; filename: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repurpose-yt-"));
  const outTemplate = path.join(tmpDir, "%(title).150B.%(ext)s");

  try {
    await runYtDlp(
      [
        "--no-playlist",
        "-o",
        outTemplate,
        "-x",
        "--audio-format",
        "mp3",
        "-f",
        "bestaudio/best",
        url
      ],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS }
    );

    const files = fs.readdirSync(tmpDir);
    if (files.length === 0) throw new Error("No audio file was produced.");
    const filePath = path.join(tmpDir, files[0]);
    const buffer = fs.readFileSync(filePath);
    if (buffer.length > MAX_SOURCE_FILE_BYTES) {
      throw new Error(
        `The pulled audio (${MAX_SOURCE_FILE_MB} MB) is over the ${MAX_SOURCE_FILE_MB} MB limit.`
      );
    }
    return { buffer, filename: files[0] };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
}
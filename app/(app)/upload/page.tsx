"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isValidYoutubeUrl } from "@/lib/youtube-url";
import {
  MAX_SOURCE_FILE_BYTES,
  MAX_SOURCE_FILE_MB,
  SOURCE_FILE_EXTENSIONS,
  DOCUMENT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
  FILE_BACKED_EXTENSIONS,
  fileExtension,
  isAllowedSourceExtension,
  isAllowedSourceMime,
  isAllowedFileBackedExtension,
  formatBytes
} from "@/lib/limits";
import { getUsage, formatResetDate } from "@/lib/billing/usage-client";
import type { ClientUsage } from "@/lib/billing/usage-client";
import { UsageNotice, parseLimitBody } from "@/components/usage-meter";
import PageHeader from "@/components/page-header";

interface YoutubeVideo {
  videoId: string;
  title: string;
  publishedAt?: string;
  thumbnail?: string | null;
}

const MODES = [
  { id: "file", label: "Upload media" },
  { id: "link", label: "Paste a link" },
  { id: "youtube", label: "YouTube" },
  { id: "transcript", label: "Transcript" }
] as const;

const FORMATS = [
  { id: "linkedin_post", label: "LinkedIn post" },
  { id: "newsletter", label: "Newsletter section" },
  { id: "shortform_script", label: "Short-form script" }
] as const;

export default function UploadPage() {
  const [mode, setMode] = useState<"file" | "link" | "youtube" | "transcript">("file");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [formats, setFormats] = useState<string[]>(FORMATS.map((f) => f.id));
  const [ytStatus, setYtStatus] = useState<{ connected: boolean; channelTitle: string | null }>({
    connected: false,
    channelTitle: null
  });
  const [ytVideos, setYtVideos] = useState<YoutubeVideo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ClientUsage | null>(null);
  const [receivedSource, setReceivedSource] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("youtube");
    if (outcome === "connected") {
      setNotice("YouTube connected — turn your own videos into drafts straight from their captions.");
    } else if (outcome === "denied") {
      setNotice("YouTube connection cancelled — your URL-paste flow still works.");
    } else if (outcome === "error" || outcome === "config") {
      setNotice("Couldn't connect YouTube. Please try again.");
    }
    void loadYoutubeStatus();
    void getUsage().then((u) => setUsage(u));
  }, []);
  const supabase = createClient();

  function toggleFormat(id: string) {
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function enqueueProcessing(sourceId: string, formats: string[], idempotencyKey: string): Promise<string> {
    const res = await fetch("/api/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, formats, idempotencyKey })
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; jobId?: string; code?: string };
    if (!res.ok || !data.jobId) {
      const { code, message } = parseLimitBody(data);
      if (code === "USAGE_LIMIT_REACHED") {
        // Nothing was created (limit checked before enqueue too) — no "saved" note.
        throw new Error(message);
      }
      // The source row already exists — the dashboard's "Start processing"
      // button can pick it up, so don't navigate with a half-started flow.
      const fallback =
        data?.error ?? "Creating couldn't be started (this can happen when rate-limited).";
      throw new Error(
        `${fallback} Your content is saved — open your library and press Start creating.`
      );
    }
    return data.jobId;
  }

  function kickProcessing(jobId: string) {
    // Fire-and-forget: the worker runs in its own invocation while we navigate
    // to the dashboard, which keeps polling/retrying if this kick is lost.
    fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      keepalive: true
    }).catch(() => {});
  }

  function validateFile(f: File): string | null {
    if (f.size > MAX_SOURCE_FILE_BYTES) {
      return `This file is ${formatBytes(f.size)} — the limit is ${MAX_SOURCE_FILE_MB} MB.`;
    }
    if (!isAllowedSourceExtension(f.name)) {
      return `Unsupported ".${fileExtension(f.name)}" file. Supported: ${SOURCE_FILE_EXTENSIONS.join(", ")}.`;
    }
    if (!isAllowedSourceMime(f.type)) {
      return `${f.type || "That file"} doesn't look like audio or video.`;
    }
    return null;
  }

  // Best-effort client-side duration probe so a user who picks a 3-hour video
  // learns the plan cap before we spend an upload + transcription slot. Falls
  // back to null (skip check) when metadata won't load in the browser.
  function probeDuration(f: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(f);
      const el = window.document.createElement("video");
      el.preload = "metadata";
      el.muted = true;
      el.src = url;
      const cleanup = () => {
        try {
          el.removeAttribute("src");
        } catch {
          // ignore
        }
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      };
      el.onloadedmetadata = () => {
        const d = el.duration;
        cleanup();
        resolve(Number.isFinite(d) && d > 0 ? d : null);
      };
      el.onerror = () => {
        cleanup();
        resolve(null);
      };
    });
  }

  function validateTranscriptFile(f: File): string | null {
    if (f.size > MAX_SOURCE_FILE_BYTES) {
      return `This file is ${formatBytes(f.size)} — the limit is ${MAX_SOURCE_FILE_MB} MB.`;
    }
    if (!isAllowedFileBackedExtension(f.name)) {
      return `Unsupported ".${fileExtension(f.name)}" file. Supported: ${FILE_BACKED_EXTENSIONS.join(", ")}.`;
    }
    return null;
  }

  async function handleTranscriptSubmit(userId: string) {
    if (!file) return;
    const invalid = validateTranscriptFile(file);
    if (invalid) throw new Error(invalid);
    const path = `${userId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from("sources").upload(path, file);
    if (uploadError) throw uploadError;

    const { data: source, error: insertError } = await supabase
      .from("sources")
      .insert({
        user_id: userId,
        title: title || file.name,
        storage_path: path,
        source_type: "transcript"
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return source.id as string;
  }

  async function handleFileSubmit(userId: string) {
    if (!file) return;
    const invalid = validateFile(file);
    if (invalid) throw new Error(invalid);
    // Client-side plan cap check (server is authoritative and re-checks after
    // ingestion). Catches long videos before an upload + transcription spend.
    if (usage?.maxInputSeconds) {
      const seconds = await probeDuration(file);
      if (seconds !== null && seconds > usage.maxInputSeconds) {
        throw new Error(
          `That recording is ~${Math.round(seconds / 60)} minutes — your plan caps sources at ${usage.maxInputMinutes} minutes. Trim it or drop a transcript of the full thing.`
        );
      }
    }
    const sourceType = file.type.startsWith("video") ? "video" : "audio";
    const path = `${userId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from("sources").upload(path, file);
    if (uploadError) throw uploadError;

    const { data: source, error: insertError } = await supabase
      .from("sources")
      .insert({
        user_id: userId,
        title: title || file.name,
        storage_path: path,
        source_type: sourceType
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return source.id as string;
  }

  async function handleYoutubeSubmit(userId: string) {
    const trimmed = youtubeUrl.trim();
    if (!isValidYoutubeUrl(trimmed)) {
      throw new Error(
        "That doesn't look like a single YouTube video — use a watch, shorts, or youtu.be link."
      );
    }

    const { data: source, error: insertError } = await supabase
      .from("sources")
      .insert({
        user_id: userId,
        title: title || trimmed,
        source_url: trimmed,
        source_type: "youtube"
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return source.id as string;
  }

  // Paste-any-link intake: YouTube links keep the existing youtube path, every
  // other public http(s) link is stored as a `transcript` source located by
  // source_url alone (migration …0003 relaxes source_has_location). The worker
  // classifies the URL (web article / blog → fetch pipeline, podcast feed →
  // RSS, supported social / unknown → honest error) and routes it to the right
  // adapter through the ingestion registry.
  async function handleLinkSubmit(userId: string) {
    const trimmed = linkUrl.trim();
    if (!/^https?:\/\/\S+/i.test(trimmed)) {
      throw new Error(
        "Enter a full http(s) link — an article, blog post, podcast feed, or YouTube video."
      );
    }

    const sourceType = isValidYoutubeUrl(trimmed) ? "youtube" : "transcript";
    const { data: source, error: insertError } = await supabase
      .from("sources")
      .insert({
        user_id: userId,
        title: title || trimmed,
        source_url: trimmed,
        source_type: sourceType
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return source.id as string;
  }

  async function loadYoutubeStatus() {
    try {
      const status = await fetch("/api/integrations/youtube/status").then((r) => r.json());
      if (status?.connected) {
        setYtStatus({ connected: true, channelTitle: status.channelTitle ?? null });
        const res = await fetch("/api/integrations/youtube/videos");
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.videos)) setYtVideos(data.videos);
      }
    } catch {
      // Non-fatal: the URL-paste flow still works without a connection.
    }
  }

  async function disconnectYoutube() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/youtube/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed.");
      setYtStatus({ connected: false, channelTitle: null });
      setYtVideos([]);
      setYoutubeUrl("");
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  function pickRecentVideo(video: YoutubeVideo) {
    setYoutubeUrl(`https://www.youtube.com/watch?v=${video.videoId}`);
    setTitle(video.title);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      // Block before creating a source row when the plan is already exhausted.
      // The server enforces the same guard; this just avoids a dead source row.
      if (usage?.atLimit) {
        throw new Error(
          `You've used all ${usage.limit} beta jobs for ${usage.windowLabel}. They reset ${formatResetDate(usage.resetAt)} — your drafts and library stay saved until then.`
        );
      }

      const sourceId =
        mode === "file"
          ? await handleFileSubmit(user.id)
          : mode === "link"
            ? await handleLinkSubmit(user.id)
            : mode === "transcript"
              ? await handleTranscriptSubmit(user.id)
              : await handleYoutubeSubmit(user.id);

      if (!sourceId) throw new Error("Could not create source.");

      // Client-generated key makes duplicate POSTs (double-click, back button,
      // retries) idempotent — they never consume a second job.
      const jobId = await enqueueProcessing(sourceId, formats, crypto.randomUUID());
      kickProcessing(jobId);
      // Land on a real "Content received" hand-off instead of silently dumping
      // to the dashboard: the next action is the user's call.
      const raw = title.trim() || "your content";
      setReceivedSource({
        id: sourceId,
        title: raw.length > 60 ? `${raw.slice(0, 57)}…` : raw
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace flex justify-center py-8 lg:py-12">
      <div className="w-full max-w-xl">
        {receivedSource ? (
          <div className="rounded-lg border border-theme-divider bg-theme-bg-paper p-6 sm:p-8">
            <span className="badge bg-primary-100 text-primary-700">Content received</span>
            <h1 className="mt-4 font-display text-xl font-semibold text-theme-text-primary">
              “{receivedSource.title}” is saved and headed to your drafts.
            </h1>
            <p className="mt-1.5 text-sm text-theme-text-secondary">
              Processing runs in the background — you don&apos;t need to wait. What would you like to do
              next?
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/agent?source=${receivedSource.id}`}
                className="btn btn-primary w-full"
              >
                Ask the agent what to create from it
              </Link>
              <Link
                href={`/agent?source=${receivedSource.id}`}
                className="btn btn-outline-primary w-full"
              >
                Choose outputs myself — ask VervAI
              </Link>
              <Link href="/library" className="btn w-full">
                Add to library and keep browsing
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-theme-text-secondary">
              Progress shows in your library and on the dashboard.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-theme-divider bg-theme-bg-paper p-6 sm:p-8">
            <PageHeader
            title="Create content from your next recording"
            description="Upload audio or video, add a transcript, or connect a YouTube video. VervAI will turn it into ready-to-edit drafts."
            />

            <div
              role="group"
              aria-label="Choose how to bring in your content"
              className="mt-6 flex flex-col gap-2 lg:flex-row lg:gap-0 lg:rounded-lg lg:bg-neutral-100 lg:p-1.5"
            >
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMode(m.id)}
                    className={`flex min-h-[44px] w-full items-center rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors lg:w-auto lg:justify-center lg:py-2.5 ${
                      active
                        ? "bg-primary-500 font-semibold text-white"
                        : "border border-theme-divider bg-theme-bg-paper text-theme-text-secondary lg:border-0 lg:bg-transparent hover:bg-primary-500/5 hover:text-theme-text-primary"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <UsageNotice usage={usage} />
              {notice && (
                <p role="status" className="rounded-lg border border-primary-500/30 bg-primary-500/5 px-3 py-2 text-xs text-theme-text-secondary">
                  {notice}
                </p>
              )}
              <div>
                <label htmlFor="title" className="form-label">
                  Title (optional)
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Episode 12 — Building in public"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-control"
                />
              </div>

              {mode === "file" ? (
                <div>
                  <label htmlFor="file" className="form-label">
                    Recording file
                  </label>
                  <input
                    id="file"
                    type="file"
                    accept="audio/*,video/*"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="form-control"
                  />
                  <p className="mt-2 text-xs text-theme-text-secondary">
                    Drop an audio or video file — up to {MAX_SOURCE_FILE_MB} MB ({SOURCE_FILE_EXTENSIONS.join(", ")}).
                  </p>
                </div>
              ) : mode === "link" ? (
                <div>
                  <label htmlFor="linkUrl" className="form-label">
                    Link
                  </label>
                  <input
                    id="linkUrl"
                    type="url"
                    required
                    placeholder="https://example.com/article, /rss/feed, or youtube.com/watch?v=..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="form-control"
                  />
                  <p className="mt-2 text-xs text-theme-text-secondary">
                    Paste any public link — a web article or blog post is read straight from the
                    page, a podcast feed pulls its episodes, and a YouTube link uses the usual
                    captions or audio path.
                  </p>
                </div>
              ) : mode === "transcript" ? (
                <div>
                  <label htmlFor="transcriptFile" className="form-label">
                    Transcript, document, or image
                  </label>
                  <input
                    id="transcriptFile"
                    type="file"
                    accept=".txt,.srt,.vtt,.md,.markdown,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.heic,.heif,.avif,text/plain,text/markdown,text/vtt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="form-control"
                  />
                  <p className="mt-2 text-xs text-theme-text-secondary">
                    Paste your own transcript, captions, a document, or an image —{" "}
                    {FILE_BACKED_EXTENSIONS.join(", ")}.
                    Text: .txt / .md / .markdown and subtitles keep their timestamps; PDF and DOCX
                    are read straight from the file; images are understood by vision (OCR). All of
                    these skip the transcription step entirely.
                    {DOCUMENT_FILE_EXTENSIONS.length > 0 && (
                      <>
                        {" "}
                        Documents: {DOCUMENT_FILE_EXTENSIONS.join(", ")}. Images:{" "}
                        {IMAGE_FILE_EXTENSIONS.join(", ")}.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="url" className="form-label">
                    YouTube URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="form-control"
                  />
                  <p className="mt-2 text-xs text-theme-text-secondary">
                    Connected to your channel we use the video&apos;s own captions — instant and
                    no download. Otherwise we pull the audio natively and transcribe it (the
                    video must be public). Long videos just take longer to download.
                  </p>
                  <div className="mt-3 rounded-lg border border-theme-divider bg-theme-bg-paper p-3">
                    {ytStatus.connected ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-theme-text-secondary">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0a7d1a]" />
                            YouTube connected
                            {ytStatus.channelTitle ? ` — ${ytStatus.channelTitle}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => void disconnectYoutube()}
                            disabled={busy}
                            className="shrink-0 text-xs text-theme-text-secondary underline underline-offset-2 hover:text-red-600"
                          >
                            Disconnect
                          </button>
                        </div>
                        {ytVideos.length > 0 && (
                          <div>
                            <select
                              aria-label="Pick a recent video"
                              className="form-control"
                              defaultValue=""
                              onChange={(e) => {
                                const v = ytVideos.find((x) => x.videoId === e.target.value);
                                if (v) pickRecentVideo(v);
                              }}
                            >
                              <option value="" disabled>
                                Pick one of your recent videos…
                              </option>
                              {ytVideos.map((v) => (
                                <option key={v.videoId} value={v.videoId}>
                                  {v.title}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-theme-text-secondary">
                              Choosing a video fills in the URL and title above.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-theme-text-secondary">
                          Connect your YouTube channel to turn your own videos into drafts straight
                          from their captions — no audio download or transcription step.
                        </p>
                        <a href="/api/integrations/youtube/connect" className="btn btn-sm btn-primary shrink-0">
                          Connect YouTube
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <span className="form-label">Choose outputs</span>
                <p className="-mt-2 mb-2 text-xs text-theme-text-secondary">
                  Pick which drafts to generate
                  {usage?.maxOutputsPerJob
                    ? ` — up to ${usage.maxOutputsPerJob} per job, all of them is the move`
                    : " — all three is the move"}
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => {
                    const active = formats.includes(f.id);
                    const overCap =
                      usage?.maxOutputsPerJob != null &&
                      formats.length >= usage.maxOutputsPerJob &&
                      !active;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        disabled={overCap}
                        onClick={() => toggleFormat(f.id)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? "border-primary-500 bg-primary-500 font-semibold text-white"
                            : "border-theme-divider bg-theme-bg-paper text-theme-text-secondary hover:border-primary-500/40 hover:text-theme-text-primary"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  busy ||
                  usage?.atLimit ||
                  formats.length === 0 ||
                  (mode === "youtube" ? !youtubeUrl : mode === "link" ? !linkUrl : !file)
                }
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {usage?.atLimit
                  ? `Plan full — resets ${formatResetDate(usage.resetAt)}`
                  : busy
                    ? "Creating your drafts…"
                    : "Create drafts"}
              </button>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
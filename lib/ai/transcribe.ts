// Transcription provider: AssemblyAI (assemblyai.com) has a genuinely free tier
// generous enough to validate this product before you pay for anything.
// Swap this out for Deepgram or OpenAI Whisper later without touching the rest of the app.

import { log } from "@/lib/logger";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

// Submit: transient 429/5xx responses get a bounded exponential retry before we give up.
const SUBMIT_ATTEMPTS = 3;
const SUBMIT_BASE_DELAY_MS = 1000;

// Poll: adaptive backoff (3s → up to 20s) instead of a fixed cadence, so long
// transcripts don't hammer the API while short ones still respond quickly.
const POLL_START_MS = 3000;
const POLL_MAX_MS = 20_000;

// Hard cap on total polling time. Keep this inside the worker's 10-minute stale
// window so a run-away function fails cleanly and the job gets re-claimed rather
// than parking.
const MAX_TOTAL_POLL_MS = 10 * 60 * 1000;

// Consecutive network/5xx poll failures allowed before failing the job (rather
// than hanging silently).
const MAX_TRANSIENT_POLL_FAILURES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function submitWithRetry(apiKey: string, fileUrl: string): Promise<string> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt++) {
    last = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({ audio_url: fileUrl })
    });
    if (last.ok) {
      const { id } = await last.json();
      return id as string;
    }
    if (last.status < 500 && last.status !== 429) break;
    if (attempt < SUBMIT_ATTEMPTS) {
      await sleep(SUBMIT_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500);
    }
  }
  throw new Error(`AssemblyAI submit failed: ${await (last as Response).text()}`);
}

async function pollUntilDone(
  apiKey: string,
  id: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const started = Date.now();
  let delay = POLL_START_MS;
  let transientFailures = 0;

  while (Date.now() - started < MAX_TOTAL_POLL_MS) {
    await sleep(delay);

    let res: Response | null;
    try {
      res = await fetch(`${ASSEMBLYAI_BASE}/transcript/${id}`, {
        headers: { authorization: apiKey }
      });
    } catch {
      res = null; // network error — retry below
    }

    if (!res || !res.ok) {
      transientFailures += 1;
      if (transientFailures >= MAX_TRANSIENT_POLL_FAILURES) {
        const message = res
          ? `Transcription polling failed (${res.status}): ${await res.text()}`
          : "Transcription polling lost the network connection.";
        log.error("assemblyai.poll_exhausted", new Error(message), { id });
        throw new Error(message);
      }
      delay = Math.min(delay * 2, POLL_MAX_MS);
      continue;
    }

    transientFailures = 0;
    delay = Math.max(POLL_START_MS, delay / 2);

    const result = await res.json();
    const elapsedPct = Math.min(35, Math.round(((Date.now() - started) / MAX_TOTAL_POLL_MS) * 35));
    onProgress?.(45 + elapsedPct);

    if (result.status === "completed") {
      log.info("assemblyai.completed", { id, duration_ms: Date.now() - started });
      return result.text as string;
    }
    if (result.status === "error") {
      log.error("assemblyai.failed", new Error(result.error), { id });
      throw new Error(`Transcription failed: ${result.error}`);
    }
  }

  log.warn("assemblyai.timed_out", { id, duration_ms: Date.now() - started });
  throw new Error(
    "Transcription timed out. The job will be retried — if this keeps happening, the recording may be too long."
  );
}

export async function transcribeAudio(
  fileUrl: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set.");

  // 1. Submit the file URL for transcription (with retry on 429/5xx).
  let id: string;
  try {
    id = await submitWithRetry(apiKey, fileUrl);
  } catch (err) {
    log.error("assemblyai.submit_failed", err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
  log.info("assemblyai.submitted", { id });
  onProgress?.(45);

  // 2. Poll with adaptive backoff until done or timed out. Move to an
  //    AssemblyAI webhook once you have real volume.
  return pollUntilDone(apiKey, id, onProgress);
}
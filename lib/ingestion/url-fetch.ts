// Sized, bounded HTTP fetch for the URL and podcast adapters (node 18+ global
// fetch; injectable for tests).
//
// Enforces a wall-clock timeout (AbortSignal), a byte cap on the response body
// (streamed, so an oversized page is cut off instead of downloaded whole), and
// maps network/timeout/non-2xx outcomes onto IngestionFailures with actionable
// reasons. Redirects are followed by the platform fetch, but the final URL /
// content-type / host are what get recorded as provenance.

import { ingestionFailure } from "./failure";

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const DEFAULT_FETCH_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FetchedContent {
  url: string; // final URL after redirects
  site: string; // final hostname
  contentType: string; // media type only (no params)
  bytes: Uint8Array;
  text: string;
  fetchedAt: string; // ISO timestamp
}

export interface HttpOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetchFn?: typeof fetch;
}

export function feedContentType(contentType: string): boolean {
  const ct = String(contentType ?? "").toLowerCase();
  return /(?:rss|atom)\+xml/.test(ct) || /^(?:text|application)\/xml/.test(ct);
}

export function htmlContentType(contentType: string): boolean {
  const ct = String(contentType ?? "").toLowerCase();
  return /^text\/html/.test(ct) || /^application\/xhtml\+xml/.test(ct);
}

// Fetch a URL with timeout + body cap, returning bytes/text + provenance. Any
// transport-level failure throws IngestionFailure so the adapters never leak a
// raw stack into sources.error_message.
export async function fetchUrl(url: string, opts: HttpOptions = {}): Promise<FetchedContent> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_FETCH_MAX_BYTES;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  let res: Response;
  try {
    res = await fetchFn(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,text/xml;q=0.9,*/*;q=0.8",
        "user-agent": "RepurposeAI-ingestion/1.0"
      }
    });
  } catch (err) {
    throw failFromTransport(err, url);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw ingestionFailure(`We couldn't reach ${url} (HTTP ${res.status}).`, {
      why: res.status === 404 || res.status === 410 ? "The page is gone." : "The site returned an error.",
      nextStep: "Check the link is correct and public, then try again."
    });
  }

  const finalUrl = res.url || url;
  let site = "";
  try {
    site = new URL(finalUrl).hostname;
  } catch {
    site = "";
  }
  const contentType = String(res.headers.get("content-type") ?? "").split(";")[0].trim();

  const bytes = await readCapped(res.body, maxBytes, url, controller);
  return { url: finalUrl, site, contentType, bytes, text: new TextDecoder("utf-8").decode(bytes), fetchedAt: new Date().toISOString() };
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  url: string,
  controller: AbortController
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw ingestionFailure("That page is too large to ingest.", {
          why: `The download exceeded the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
          nextStep: "Try a shorter page or a different source."
        });
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw ingestionFailure(`Fetching ${url} timed out.`, {
        nextStep: "Try again — the site may be slow right now."
      });
    }
    throw err;
  }
  return join(chunks);
}

function join(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function failFromTransport(err: unknown, url: string): unknown {
  if (err instanceof Error && err.name === "AbortError") {
    return ingestionFailure(`Fetching ${url} timed out.`, {
      nextStep: "Try again — the site may be slow right now."
    });
  }
  // Fetch rejects with TypeError on DNS/connection failure.
  if (err instanceof TypeError || (err instanceof Error && /fetch failed|network request failed|ENOTFOUND|ECONNREFUSED/i.test(err.message))) {
    return ingestionFailure(`We couldn't reach ${url}.`, {
      why: "The site didn't respond, which usually means a typo, a dead site, or no access from here.",
      nextStep: "Check the link is correct and public, then try again."
    });
  }
  return err;
}
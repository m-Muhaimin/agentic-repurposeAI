// URL intake adapter (kind `url`).
//
// One adapter for every URL-backed source that isn't a YouTube video or a
// podcast feed: class detection decides what the link is, web articles and
// blogs run the same fetch → readable-HTML → canonical-content pipeline,
// YouTube feeds delegate exactly to the existing YouTube ingestion (unchanged
// yt behavior), podcast feeds delegate to the podcast pipeline, known social
// links and unknown links fail with honest, actionable messages instead of a
// fetch. fetch provenance (final url, fetchedAt, contentType, site) lands in
// the source metadata. Idempotent per normalized URL via the idempotency store.

import { validateUrl, normalizeUrl } from "./url-validate";
import { classifySourceUrl, unsupportedMessage, socialLabel, type UrlClass } from "./url-classify";
import { fetchUrl, feedContentType, htmlContentType, type HttpOptions } from "./url-fetch";
import { htmlToReadable, type ReadableContent } from "./html-readable";
import { ingestYouTube } from "./youtube";
import { ingestPodcastFeed } from "./podcast-adapter";
import { ingestionFailure, isIngestionFailure } from "./failure";
import { contentHash, findReusableSource, persistHashSafely, type ContentStore } from "./idempotency";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";
import type { IngestionProvider, IngestValidation, SourceKind } from "./registry";

const KIND: SourceKind = "url";
const PROVIDER = "web";

export type UrlExtractor = (html: string) => ReadableContent;

export interface UrlProviderOptions extends HttpOptions {
  // Injectable HTML→readable extractor (tests inject a stub).
  extract?: UrlExtractor;
  // Optional idempotency store (sources lookup by content hash).
  store?: ContentStore;
  // Delegate an incoming youtube-class URL to the existing YouTube ingestion.
  youtubeDelegate?: (source: IngestSource, ctx: IngestionContext) => Promise<TranscriptDocument>;
  // Delegate feed content (either classified, or discovered by content-type) to
  // the podcast pipeline.
  podcastDelegate?: (feedUrl: string, source: IngestSource, ctx: IngestionContext) => Promise<TranscriptDocument>;
}

export async function ingestWebUrl(
  source: IngestSource,
  ctx: IngestionContext,
  opts: UrlProviderOptions = {}
): Promise<TranscriptDocument> {
  const raw = source.source_url ?? "";
  const validation = validateUrl(raw);
  if (!validation.ok) {
    throw ingestionFailure(validation.errors[0] ?? "That URL isn't valid.", {
      nextStep: "Enter a public http(s) link to an article, blog post, podcast feed, or YouTube video."
    });
  }

  const klass = classifySourceUrl(raw);
  if (klass === "youtube") {
    const delegate = opts.youtubeDelegate ?? ((s, c) => ingestYouTube({ ...s, source_type: "youtube" }, c));
    return delegate(source, ctx);
  }

  if (klass === "podcast_rss") {
    return (opts.podcastDelegate ?? ((url, s, c) => ingestPodcastFeed(url, s, c, { fetchFn: opts.fetchFn })))(
      raw,
      source,
      ctx
    );
  }

  const unsupported = unsupportedMessage(klass);
  if (unsupported) {
    throw ingestionFailure(unsupported.reason, {
      why: klass === "supported_social" ? socialLabel(raw) ?? undefined : undefined,
      nextStep: unsupported.nextStep
    });
  }

  // web_article / blog: one fetch → extract → canonical pipeline.
  ctx.onProgress?.("Fetching page", 15);
  let fetched;
  try {
    fetched = await fetchUrl(raw, { fetchFn: opts.fetchFn, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes });
  } catch (err) {
    if (isIngestionFailure(err)) throw err;
    throw ingestionFailure(`We couldn't reach ${raw}.`, {
      why: "The site didn't respond.",
      nextStep: "Check the link is correct and public, then try again."
    });
  }

  if (feedContentType(fetched.contentType)) {
    return (opts.podcastDelegate ?? ((url, s, c) => ingestPodcastFeed(url, s, c, { fetchFn: opts.fetchFn })))(
      fetched.url,
      source,
      ctx
    );
  }

  if (!htmlContentType(fetched.contentType) && !fetched.text.trim().startsWith("<")) {
    throw ingestionFailure("That page isn't readable as an article.", {
      why: `The URL returned ${fetched.contentType || "an unknown content type"} instead of a web page.`,
      nextStep: "Try a plain web page or a different source."
    });
  }

if (opts.store) {
    const hash = contentHash(new TextEncoder().encode(validation.normalized ?? raw));
    const reuse = await findReusableSource(opts.store, source, KIND, hash);
    if (reuse) {
      ctx.onProgress?.("Reusing existing content", 90);
      return { text: reuse.transcript, provider: PROVIDER, source: { type: source.source_type, url: raw } };
    }
  }

  ctx.onProgress?.("Extracting content", 60);
  const readable = (opts.extract ?? htmlToReadable)(fetched.text);
  const text = readable.text.trim();
  if (!text) {
    throw ingestionFailure("We didn't find any readable text on that page.", {
      why: "The page may be a video, an image, a login gate, or a document.",
      nextStep: "Try an article page you can read in a browser without signing in."
    });
  }

  ctx.onProgress?.("Ready", 100);
  if (opts.store) {
    const hash = contentHash(new TextEncoder().encode(validation.normalized ?? raw));
    await persistHashSafely(opts.store, source.id, hash);
  }
  const title = readable.title ?? source.title ?? null;
  const doc: TranscriptDocument = {
    text,
    provider: PROVIDER,
    metadata: {
      kind: klass,
      url: raw,
      fetchedAt: fetched.fetchedAt,
      contentType: fetched.contentType,
      site: fetched.site,
      title: readable.title,
      siteName: readable.siteName
    },
    source: {
      type: source.source_type,
      url: raw,
      title: readable.title ?? source.title ?? undefined
    }
  };
  return doc;
}

export function urlProvider(opts: UrlProviderOptions = {}): IngestionProvider {
  return {
    sourceTypes: [],
    kinds: [KIND],
    canHandle(source: IngestSource): boolean {
      return source.source_url != null && classifySourceUrl(source.source_url) !== "youtube";
    },
    validate(source: IngestSource): IngestValidation {
      if (!source.source_url) {
        return { ok: false, kind: KIND, errors: ["No URL was provided."] };
      }
      const v = validateUrl(source.source_url);
      return { ok: v.ok, errors: v.errors, kind: KIND };
    },
    ingest: async (source, ctx) => {
      if (!source.source_url) {
        throw ingestionFailure("No URL was provided.", { nextStep: "Add a source URL to this source." });
      }
      return ingestWebUrl(source, ctx, opts);
    },
    normalize: (doc: TranscriptDocument) => doc
  };
}
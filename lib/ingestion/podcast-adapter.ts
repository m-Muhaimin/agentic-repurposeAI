// Podcast feed intake adapter (kind `podcast`).
//
// Fetch a podcast RSS/Atom feed, pick one episode (by index or latest), and
// produce the canonical content shape: the episode's own description/title as
// text (honest feed-derived content), the episode's audio URL kept as a
// reference in the source metadata (never duplicated media), fetch provenance
// (url, fetchedAt, contentType, site), and duration. Transcription of the audio
// itself is a separate, later job through the existing transcript pipeline —
// this adapter only resolves the reference.
//
// Idempotent per feed URL: the same feed for the same user reuses the earlier
// ingest via the idempotency store (key = {"podcast", sha256(normalizedURL)}).

import { validateUrl } from "./url-validate";
import { fetchUrl, feedContentType, htmlContentType, type HttpOptions } from "./url-fetch";
import { parseRssFeed, selectEpisode, type PodcastFeed, type PodcastEpisode } from "./podcast-rss";
import { ingestionFailure } from "./failure";
import { contentHash, findReusableSource, idempotencyKey, type ContentStore } from "./idempotency";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";
import type { IngestionProvider, IngestValidation, SourceKind } from "./registry";

export interface PodcastProviderOptions extends HttpOptions {
  // Injectable feed parser (tests pass a stub to avoid XML/branch matrix).
  parseFeed?: (xml: string) => PodcastFeed;
  // Optional idempotency store (sources lookup by content hash).
  store?: ContentStore;
  // Pick a specific episode by feed-order index (0 = first, usually newest).
  episodeIndex?: number;
}

const KIND: SourceKind = "podcast";
const PROVIDER = "podcast_rss";

function looksLikeFeed(text: string): boolean {
  return /^\s*(?:<\?xml[^>]*>\s*)?<(?:rss|feed)\b/i.test(text.trim());
}

function failUnreachable(url: string, err: unknown): never {
  if (err instanceof Error && err.name === "IngestionFailure") {
    throw err;
  }
  throw ingestionFailure(`We couldn't reach the podcast feed at ${url}.`, {
    why: "The feed didn't respond or isn't a public URL.",
    nextStep: "Check the feed URL is correct and public, then try again."
  });
}

// The standalone feed→episode→canonical-content pipeline, shared by the
// podcast provider and the URL adapter's feed delegation.
export async function ingestPodcastFeed(
  feedUrl: string,
  source: IngestSource,
  ctx: IngestionContext,
  opts: PodcastProviderOptions = {}
): Promise<TranscriptDocument> {
  const validation = validateUrl(feedUrl);
  if (!validation.ok) {
    throw ingestionFailure(validation.errors[0] ?? "That URL isn't valid.", {
      nextStep: "Enter a public podcast feed URL beginning with http:// or https://."
    });
  }

  ctx.onProgress?.("Fetching podcast feed", 15);
  let fetched;
  try {
    fetched = await fetchUrl(feedUrl, { fetchFn: opts.fetchFn, timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes });
  } catch (err) {
    failUnreachable(feedUrl, err);
  }

  if (!feedContentType(fetched.contentType) && !looksLikeFeed(fetched.text)) {
    throw ingestionFailure("This doesn't look like a podcast feed.", {
      why:
        htmlContentType(fetched.contentType) || fetched.text.trim().startsWith("<html")
          ? "The URL returned a web page instead of a feed."
          : `The URL returned ${fetched.contentType || "an unknown content type"}.`,
      nextStep: "Paste the feed's .xml/.rss link (usually under the podcast's RSS icon)."
    });
  }

  ctx.onProgress?.("Parsing feed", 40);
  let feed: PodcastFeed;
  try {
    feed = (opts.parseFeed ?? parseRssFeed)(fetched.text);
  } catch {
    throw ingestionFailure("We couldn't parse this podcast feed.", {
      why: "The XML didn't match a recognisable RSS or Atom feed.",
      nextStep: "Copy the exact feed link from the podcast's site and try again."
    });
  }
  if (feed.episodes.length === 0) {
    throw ingestionFailure("No episodes were found in this feed.", {
      nextStep: "Check the feed has published episodes, or try a different feed."
    });
  }

  const selection = selectEpisode(feed, opts.episodeIndex != null ? { index: opts.episodeIndex } : {});
  const episode = selection.episode;
  if (!episode) {
    throw ingestionFailure(
      `Couldn't pick episode ${opts.episodeIndex ?? 0} from this feed (${feed.episodes.length} available).`,
      { nextStep: "Pick an episode index within the feed's episode list." }
    );
  }
  if (!episode.audioUrl) {
    throw ingestionFailure("This episode has no playable audio link.", {
      why: "The feed entry doesn't carry an audio enclosure.",
      nextStep: "Try a different episode or a different feed."
    });
  }

  if (opts.store) {
    const normalized = validation.normalized ?? feedUrl;
    const hash = contentHash(new TextEncoder().encode(normalized));
    const reuse = await findReusableSource(opts.store, source, KIND, hash);
    if (reuse) {
      ctx.onProgress?.("Reusing existing feed", 90);
      return { text: reuse.transcript, provider: PROVIDER, source: episodeSource(source, feedUrl, episode, feed) };
    }
  }

  const text = chooseEpisodeText(episode, feed);
  ctx.onProgress?.("Ready", 100);

  const doc: TranscriptDocument = {
    text,
    provider: PROVIDER,
    durationSeconds: episode.durationSeconds ?? undefined,
    metadata: {
      kind: "podcast",
      feedUrl,
      fetchedAt: fetched.fetchedAt,
      contentType: fetched.contentType,
      site: fetched.site,
      episodeIndex: selection.index,
      episodeGuid: episode.guid,
      episodeTitle: episode.title,
      audioUrl: episode.audioUrl,
      durationSeconds: episode.durationSeconds,
      publishedAt: episode.publishedAt,
      episodesTotal: feed.episodes.length
    },
    source: episodeSource(source, feedUrl, episode, feed)
  };
  return doc;
}

function episodeSource(
  source: IngestSource,
  feedUrl: string,
  episode: PodcastEpisode,
  feed: PodcastFeed
): TranscriptDocument["source"] {
  return {
    type: source.source_type,
    url: feedUrl,
    title: episode.title ?? source.title ?? undefined,
    author: feed.title ?? undefined
  };
}

function chooseEpisodeText(episode: PodcastEpisode, feed: PodcastFeed): string {
  const text = (episode.description ?? episode.title ?? feed.title ?? "").trim();
  if (!text) {
    throw ingestionFailure("This episode has no description to ingest.", {
      why: "The feed entry is empty apart from its audio link.",
      nextStep: "Try a different episode."
    });
  }
  return text;
}

export function podcastProvider(opts: PodcastProviderOptions = {}): IngestionProvider {
  return {
    sourceTypes: [],
    kinds: [KIND],
    canHandle(source: IngestSource): boolean {
      return source.source_url != null;
    },
    validate(source: IngestSource): IngestValidation {
      if (!source.source_url) {
        return { ok: false, kind: KIND, errors: ["No feed URL was provided."] };
      }
      const v = validateUrl(source.source_url);
      return { ok: v.ok, errors: v.errors, kind: KIND };
    },
    ingest: async (source, ctx) => {
      if (!source.source_url) {
        throw ingestionFailure("No feed URL was provided.", {
          nextStep: "Add the podcast feed URL to this source."
        });
      }
      return ingestPodcastFeed(source.source_url, source, ctx, opts);
    },
    normalize: (doc: TranscriptDocument) => doc
  };
}
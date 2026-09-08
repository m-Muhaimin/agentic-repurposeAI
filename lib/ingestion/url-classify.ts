// URL class detection (pure).
//
// Given a validated URL, decide *what* it is so the registry can route it to
// the right adapter: YouTube videos (delegate to the existing yt path), podcast
// feeds, articles/blogs (one extraction pipeline), known-but-unsupported social
// links (honest "not yet" error), and everything else (graceful unsupported
// error). Classification is URL-only and conservative — a feed served without a
// feed-ish URL is still caught at fetch time by content-type sniffing in the
// adapters. No I/O.

import type { SourceKind } from "./registry";
import { validateUrl } from "./url-validate";

export type UrlClass =
  | "youtube"
  | "web_article"
  | "blog"
  | "podcast_rss"
  | "supported_social"
  | "unsupported";

const YOUTUBE_HOSTS = ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com"];

const PODCAST_FEED_PATH = /(^|\/)(?:feed|feeds|rss|rss2|podcast|atom|category)\/?$/;
const PODCAST_FEED_EXT = /\.(?:rss|rss2|xml|atom|opml|feed)$/i;

interface SocialHost {
  host: string;
  label: string;
}

const SOCIAL_HOSTS: SocialHost[] = [
  { host: "twitter.com", label: "a Twitter/X link" },
  { host: "x.com", label: "a Twitter/X link" },
  { host: "instagram.com", label: "an Instagram link" },
  { host: "tiktok.com", label: "a TikTok link" },
  { host: "threads.net", label: "a Threads link" },
  { host: "facebook.com", label: "a Facebook link" },
  { host: "fb.com", label: "a Facebook link" },
  { host: "reddit.com", label: "a Reddit link" },
  { host: "pinterest.com", label: "a Pinterest link" },
  { host: "snapchat.com", label: "a Snapchat link" },
  { host: "twitch.tv", label: "a Twitch link" }
];

function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./, "").replace(/\.$/, "").toLowerCase();
}

function isHost(url: URL, host: string): boolean {
  const h = hostOf(url);
  return h === host || h.endsWith(`.${host}`);
}

function isYoutube(url: URL): boolean {
  return YOUTUBE_HOSTS.some((host) => isHost(url, host));
}

function isFeedUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  if (PODCAST_FEED_EXT.test(path)) return true;
  if (PODCAST_FEED_PATH.test(path)) return true;
  // Common host-served feeds: anchor / libsyn / buzzsprout / podbean /
  // transistor / castos-style provider pages all expose /rss or /feed too so
  // the path rules cover them; a couple of dedicated feed hosts get a direct hit.
  return isHost(url, "feeds.feedburner.com") || isHost(url, "feedburner.google.com");
}

function socialMatch(url: URL): SocialHost | null {
  const h = hostOf(url);
  return SOCIAL_HOSTS.find((s) => h === s.host || h.endsWith(`.${s.host}`)) ?? null;
}

// Docs match on `*.docs.google.com` etc are gated content — nothing in this
// list needs recognizing beyond the generic "web page" treatement.
function isBlog(url: URL): boolean {
  const h = hostOf(url);
  if (h.split(".").includes("blog")) return true;
  return /\/blog\/?/i.test(url.pathname) || /\/articles?\//i.test(url.pathname);
}

export function classifySourceUrl(raw: string): UrlClass {
  const validated = validateUrl(raw);
  if (!validated.ok || !validated.url) return "unsupported";

  const url = validated.url;
  if (isYoutube(url)) return "youtube";
  if (isFeedUrl(url)) return "podcast_rss";
  if (socialMatch(url)) return "supported_social";
  if (isBlog(url)) return "blog";
  return "web_article";
}

// Which registry kind a URL-backed source row should dispatch on. YouTube stays
// on the existing youtube kind (identical behavior); feeds go to the podcast
// adapter; every other reachable web page rides the generic `url` kind whose
// adapter then classifies again (and errors honestly for the unsupported
// subset). Unparseable input returns null so dispatch falls back to the
// source_type switch unchanged.
export function sourceKindForUrl(raw: string): SourceKind | null {
  const kind = classifySourceUrl(raw);
  if (kind === "youtube") return "youtube";
  if (kind === "podcast_rss") return "podcast";
  if (kind === "web_article" || kind === "blog" || kind === "supported_social" || kind === "unsupported") {
    return "url";
  }
  return null;
}

// Honest, human messages for the two "we can't ingest this" classes. The URL
// adapter throws these as IngestionFailures so the worker surfaces a phrased
// reason instead of a raw parser error.
export function unsupportedMessage(kind: UrlClass): { reason: string; nextStep: string } | null {
  if (kind === "supported_social") {
    return {
      reason: "We don't support that source yet — this looks like a social post.",
      nextStep: "Try a YouTube video, a web article, or a podcast feed instead."
    };
  }
  if (kind === "unsupported") {
    return {
      reason: "We couldn't recognize that link as a source we can ingest.",
      nextStep: "Try a YouTube video, a web article, or a podcast feed — we can't follow links into apps or gated pages."
    };
  }
  return null;
}

export function socialLabel(raw: string): string | null {
  const validated = validateUrl(raw);
  if (!validated.ok || !validated.url) return null;
  return socialMatch(validated.url)?.label ?? null;
}
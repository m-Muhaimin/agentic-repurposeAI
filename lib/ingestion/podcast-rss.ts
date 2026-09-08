// Podcast feed parsing (pure).
//
// Parses RSS 2.0 and Atom podcast feeds into a flat episode list (title,
// description, publishedAt, audio URL, duration) so the podcast adapter can
// pick a single episode without touching the media itself — the audio is kept
// as a URL reference, never duplicated. fast-xml-parser handles namespaces
// (itunes:/dc:/media:/content:) and CDATA; the wrappers below normalise the
// shaped output to the canonical PodcastFeed/PodcastEpisode model.

import { XMLParser } from "fast-xml-parser";

export interface PodcastEpisode {
  guid: string | null;
  title: string | null;
  description: string | null;
  publishedAt: string | null; // ISO 8601 when the feed date is parseable
  audioUrl: string | null;
  durationSeconds: number | null;
}

export interface PodcastFeed {
  title: string | null;
  description: string | null;
  link: string | null;
  language: string | null;
  episodes: PodcastEpisode[];
}

type XmlNode = string | number | boolean | { [key: string]: XmlNode } | XmlNode[] | null | undefined;

function asArray(node: XmlNode): XmlNode[] {
  if (Array.isArray(node)) return node;
  return node == null ? [] : [node];
}

function textOf(node: XmlNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (node != null && typeof node === "object" && !Array.isArray(node)) {
    const inner = node["#text"];
    if (typeof inner === "string") return inner;
  }
  return "";
}

function attr(node: XmlNode, name: string): string | null {
  if (node == null || typeof node !== "object" || Array.isArray(node)) return null;
  const v = node[`@_${name}`];
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

// itunes:duration arrives as "3600", "12:30" or "1:02:03".
export function parseDurationSeconds(raw: XmlNode): number | null {
  const s = textOf(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function normalizeFeedDate(raw: XmlNode): string | null {
  const s = textOf(raw).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function firstAudioLink(node: XmlNode): string | null {
  for (const link of asArray(node)) {
    if (typeof link === "string") continue;
    const type = attr(link, "type") ?? "";
    const rel = attr(link, "rel") ?? "";
    const href = attr(link, "href");
    if (href && (type.toLowerCase().startsWith("audio/") || rel.toLowerCase() === "enclosure")) return href;
  }
  return null;
}

function audioFromEnclosure(enclosure: XmlNode): string | null {
  const url = attr(enclosure, "url");
  if (!url) return null;
  const type = attr(enclosure, "type") ?? "";
  if (type && !type.toLowerCase().startsWith("audio/") && !type.toLowerCase().includes("mpeg")) return null;
  return url;
}

function rssEpisode(item: { [key: string]: XmlNode }): PodcastEpisode {
  let audioUrl: string | null = null;
  const enclosure = item.enclosure;
  if (enclosure != null) {
    audioUrl = audioFromEnclosure(enclosure);
  }
  if (!audioUrl) audioUrl = firstAudioLink(item.link);

  const publishedRaw = item.pubDate ?? item.date ?? item.updated;
  return {
    guid: textOf(item.guid) || textOf(item.id) || textOf(item.link) || null,
    title: textOf(item.title) || null,
    description: textOf(item.description) || textOf(item.summary) || textOf(item.encoded) || null,
    publishedAt: normalizeFeedDate(publishedRaw),
    audioUrl,
    durationSeconds: parseDurationSeconds(item.duration)
  };
}

function atomEpisode(entry: { [key: string]: XmlNode }): PodcastEpisode {
  const audioUrl =
    firstAudioLink(entry.link) ?? audioFromEnclosure(entry.enclosure) ?? null;
  const publishedRaw = entry.published ?? entry.updated;
  const title = textOf(entry.title);
  return {
    guid: textOf(entry.id) || null,
    title: title || null,
    description: textOf(entry.summary) || textOf(entry.content) || null,
    publishedAt: normalizeFeedDate(publishedRaw),
    audioUrl,
    durationSeconds: parseDurationSeconds(entry.duration)
  };
}

// Parse a feed document (RSS 2.0 with itunes/dc/media extensions, or Atom) into
// the canonical model. Feeds that neither shape yields are "no episodes" (the
// caller decides whether that's malformed — the XML-level parse failure throws).
export function parseRssFeed(xml: string): PodcastFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    processEntities: true,
    htmlEntities: true,
    trimValues: true
  });
  const root = parser.parse(xml) as XmlNode;

  if (root != null && typeof root === "object" && !Array.isArray(root)) {
    const rss = root.rss;
    if (rss != null && typeof rss === "object" && !Array.isArray(rss)) {
      const channel = rss.channel;
      if (channel != null && typeof channel === "object" && !Array.isArray(channel)) {
        return {
          title: textOf(channel.title) || null,
          description: textOf(channel.description) || null,
          link: textOf(channel.link) || null,
          language: textOf(channel.language) || null,
          episodes: asArray(channel.item).map((item) =>
            item != null && typeof item === "object" && !Array.isArray(item)
              ? rssEpisode(item as Record<string, XmlNode>)
              : emptyEpisode()
          )
        };
      }
    }

    const atom = root.feed;
    if (atom != null && typeof atom === "object" && !Array.isArray(atom)) {
      const feed = atom as Record<string, XmlNode>;
      return {
        title: textOf(feed.title) || null,
        description: textOf(feed.subtitle) || textOf(feed.tagline) || null,
        link: firstAudioLink(feed.link) || textOf(feed.link) || null,
        language: attr(feed, "xml:lang") ?? attr(feed, "lang") ?? null,
        episodes: asArray(feed.entry).map((entry) =>
          entry != null && typeof entry === "object" && !Array.isArray(entry)
            ? atomEpisode(entry as Record<string, XmlNode>)
            : emptyEpisode()
        )
      };
    }
  }

  return { title: null, description: null, link: null, language: null, episodes: [] };
}

function emptyEpisode(): PodcastEpisode {
  return {
    guid: null,
    title: null,
    description: null,
    publishedAt: null,
    audioUrl: null,
    durationSeconds: null
  };
}

export interface EpisodeSelection {
  episode: PodcastEpisode | null;
  index: number; // index into feed.episodes, -1 when nothing matched
}

// Pick the episode to ingest: an explicit index (0 = first episode in the feed,
// conventionally the newest), or — by default — the latest published. Returns
// null when the index is out of range or the feed has no episodes.
export function selectEpisode(
  feed: PodcastFeed,
  opts: { index?: number } = {}
): EpisodeSelection {
  const episodes = feed.episodes;
  if (episodes.length === 0) return { episode: null, index: -1 };

  if (opts.index != null) {
    const i = Number(opts.index);
    if (Number.isInteger(i) && i >= 0 && i < episodes.length) {
      return { episode: episodes[i], index: i };
    }
    return { episode: null, index: -1 };
  }

  let best = 0;
  for (let i = 1; i < episodes.length; i++) {
    const pa = episodes[i].publishedAt;
    const pb = episodes[best].publishedAt;
    const a = pa ? Date.parse(pa) : Number.NaN;
    const b = pb ? Date.parse(pb) : Number.NaN;
    if (Number.isFinite(a) && (!Number.isFinite(b) || a > b)) best = i;
  }
  return { episode: episodes[best], index: best };
}
// Lightweight readable-HTML extraction (pure, dependency-free).
//
// The web-article pipeline converts a fetched HTML page into canonical text
// without a scraper dependency: strip script/style/nav noise, map headings and
// lists to markdown-ish markers, unwrap links to their visible text, decode
// entities, and collapse whitespace. Deliberately simple — it never executes
// scripts and never fabricates content; an empty result is a real failure the
// adapter surfaces as a parse failure.
//
// This is a cheap, honest extractor (headings, paragraphs, lists, quotes), not
// a full article-mode reader. If the page yields no recognizable text blocks
// the adapter fails rather than inventing a transcript.

export interface ReadableContent {
  title: string | null;
  siteName: string | null;
  text: string;
}

const BLOCK_BOUNDARY = new RegExp(
  "\\s*</?(?:p|div|section|article|header|footer|nav|aside|main|ul|ol|table|tr|figure|figcaption|hr|fieldset|form|address|pre|details|summary)\\b[^>]*>\\s*",
  "g"
);

// Tags whose content is never part of an article.
const NOISE_TAGS = ["script", "style", "noscript", "template", "svg", "iframe", "object", "embed", "canvas"];

const HEADING_TAGS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"'
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, code: string) => {
    if (code.startsWith("#x")) {
      const n = parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    if (code.startsWith("#")) {
      const n = parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[match] ?? match;
  });
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)`,
    "i"
  );
  const other = new RegExp(
    `<meta[^>]+content=["'][^"']*["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  const a = html.match(re);
  if (a) return decodeEntities(a[1]).trim();
  const b = html.match(other);
  if (b) {
    const m = b[0].match(/content=["']([^"']*)/i);
    return m ? decodeEntities(m[1]).trim() : null;
  }
  return null;
}

export function extractPageTitle(html: string): string | null {
  const og = metaContent(html, "og:title");
  if (og) return og;
  const t = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!t) return null;
  const inner = decodeEntities(t[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return inner || null;
}

export function extractSiteName(html: string): string | null {
  const og = metaContent(html, "og:site_name");
  return og ? decodeEntities(og).trim() : null;
}

export function htmlToReadable(html: string): ReadableContent {
  const title = extractPageTitle(html);
  const siteName = extractSiteName(html);

  let doc = String(html ?? "");
  for (const tag of NOISE_TAGS) {
    doc = doc.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
  }
  doc = doc.replace(/<!--[\s\S]*?-->/g, " ");

  // Markdown-ish markers before the generic tag strip.
  for (const [tag, level] of Object.entries(HEADING_TAGS)) {
    doc = doc.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), `\n${"#".repeat(level)} `);
    doc = doc.replace(new RegExp(`</${tag}>`, "gi"), "\n");
  }
  doc = doc.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "\n");
  doc = doc.replace(/<blockquote\b[^>]*>/gi, "\n> ").replace(/<\/blockquote>/gi, "\n");
  doc = doc.replace(/<br\b[^>]*\/?>/gi, "\n");
  doc = doc.replace(BLOCK_BOUNDARY, "\n");
  // Inline code spans keep their backticks; pre blocks already got newlines.
  doc = doc
    .replace(/<code\b[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    // Images reduce to their alt text (honest, verifiable) or a marker.
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, " [$1] ")
    .replace(/<img\b[^>]*>/gi, " [image] ");
  // Links unwrap to their visible text — hrefs are noise for content.
  doc = doc.replace(/<a\b[^>]*>/gi, "").replace(/<\/a>/gi, "");
  doc = doc.replace(/<[^>]+>/g, " ");

  const decoded = decodeEntities(doc);
  const lines = decoded
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l !== "");
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { title, siteName, text };
}
// Shared subtitle parsing — SRT and VTT — into the canonical TranscriptSegment
// representation. Pure module (no I/O): used by the YouTube captions provider
// and the transcript-file provider alike.

import type { TranscriptSegment } from "@/lib/ingestion/types";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&#160;": " "
};

function decodeEntities(input: string): string {
  return input.replace(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g, (match, code: string) => {
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

function cleanCueText(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, "") // <font ...> / <v First> markers
    .replace(/\{[^}]*\}/g, "") // vtt cue settings
    .replace(/\s+/g, " ")
    .trim();
}

function toMs(h: string, m: string, s: string, ms: string): number {
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms);
}

function normalize(input: string): string {
  return String(input).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

// SRT: blocks of `<index>\n<hh:mm:ss,mmm --> hh:mm:ss,mmm>\n<text…>`.
export function parseSrt(srt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const block of normalize(srt).split(/\n{2,}/)) {
    const match = block.match(
      /^\d+\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n([\s\S]*)$/
    );
    if (!match) continue;
    const [, h1, m1, s1, f1, h2, m2, s2, f2, rawText] = match;
    const text = cleanCueText(rawText);
    if (!text) continue;
    segments.push({ startMs: toMs(h1, m1, s1, f1), endMs: toMs(h2, m2, s2, f2), text });
  }
  return segments;
}

// VTT: `WEBVTT` header (plus optional NOTE/STYLE/identifier lines), then blocks
// of `[<identifier>\n]<hh:mm:ss.mmm --> hh:mm:ss.mmm [settings]>\n<text…>`.
// Identifiers are one non-blank line that isn't itself a cue timing.
export function parseVtt(vtt: string): TranscriptSegment[] {
  const normalized = normalize(vtt);
  // Drop the WEBVTT header block (first blank-line-separated chunk).
  const body = normalized.startsWith("WEBVTT") ? normalized.slice(normalized.indexOf("\n") + 1) : normalized;
  const segments: TranscriptSegment[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const match = block.match(
      /^(?:(?!.*-->)[^\n]*\n)?(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})[^\n]*\n?([\s\S]*)$/
    );
    if (!match) continue;
    const [, h1, m1, s1, f1, h2, m2, s2, f2, rawText] = match;
    const text = cleanCueText(rawText);
    if (!text) continue;
    segments.push({ startMs: toMs(h1, m1, s1, f1), endMs: toMs(h2, m2, s2, f2), text });
  }
  return segments;
}

// True when the text contains at least one cue timing line regardless of file
// extension — lets a `.txt` that's secretly SRT/VTT get parsed properly.
export function looksLikeSubtitles(text: string): boolean {
  return /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(text);
}

export function segmentsToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join("\n");
}
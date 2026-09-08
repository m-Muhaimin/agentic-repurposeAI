// Evidence & provenance (pure).
//
// Formalizes how a claim or output is grounded in the source. The planner
// already stores verbatim `quotes` on v4_content_ideas and the evaluator runs a
// deterministic grounding check; this module makes that linkage explicit:
//
//  - Provenance: which mechanism produced the transcript, from which source,
//    with which provider-side transcript id.
//  - Evidence: a quote pinned to the exact segment(s) and timestamps it came
//    from, so grounding, plan-view, and future tool calls can point at the
//    source rather than re-search the text.
//
// Pure (no I/O): resolves against a TranscriptDocument already in memory.

import type { TranscriptDocument, TranscriptSegment } from "./types";

// Provenance of a canonical transcript: what produced it and from where.
export interface TranscriptProvenance {
  provider: string | null; // assemblyai | youtube_captions | transcript_file
  providerTranscriptId: string | null;
  language: string | null;
  durationSeconds: number | null;
  sourceType: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  sourceAuthorId: string | null;
  segmentCount: number;
}

// A single piece of evidence: verbatim text pinned to its source location(s).
export interface Evidence {
  quote: string; // verbatim span pulled from a segment (or the whole text)
  startMs: number | null;
  endMs: number | null;
  sourceIndex: number; // index into doc.segments when segments exist, else -1
  raw: string; // the exact stored str: the full segment text (trimmed) or doc.text span
}

// The grounding surface the deterministic evaluator + planner use: the quotes
// tied to evidence, plus the provenance they came from.
export interface EvidenceMap {
  provenance: TranscriptProvenance;
  evidence: Evidence[];
}

// Normalize text the way grounding compares it: lowercase, collapse whitespace.
// Reuses the same normalization the agent's verbatim quote search uses.
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Build provenance from a completed canonical transcript.
export function provenanceOf(doc: TranscriptDocument): TranscriptProvenance {
  return {
    provider: doc.provider ?? null,
    providerTranscriptId: doc.providerTranscriptId ?? null,
    language: doc.language ?? null,
    durationSeconds: doc.durationSeconds ?? null,
    sourceType: doc.source.type,
    sourceUrl: doc.source.url ?? null,
    sourceTitle: doc.source.title ?? null,
    sourceAuthor: doc.source.author ?? null,
    sourceAuthorId: doc.source.authorId ?? null,
    segmentCount: doc.segments?.length ?? 0
  };
}

// Resolve a quote (possibly a fragment, e.g. "grit your teeth") against the
// transcript to the exact segment that contains it. Returns the canonical
// Evidence with timestamps when pinned to a segment; falls back to a
// whole-text span with null timestamps when segmentation is unavailable.
// Verbatim semantics only — no fuzzy matching, so grounding stays honest.
export function evidenceForQuote(doc: TranscriptDocument, quote: string): Evidence | null {
  const needle = normalizeText(quote);
  if (needle === "") return null;

  if (doc.segments && doc.segments.length > 0) {
    const idx = findSegmentContaining(doc.segments, needle);
    if (idx >= 0) {
      const seg = doc.segments[idx];
      return {
        quote: seg.text.trim(),
        startMs: seg.startMs,
        endMs: seg.endMs,
        sourceIndex: idx,
        raw: seg.text.trim()
      };
    }
  }

  // No segments, or the quote crosses a segment boundary: fall back to the
  // flattened text so a cross-segment quote still resolves to *the text* even
  // if we can't timestamp it.
  if (normalizeText(doc.text).includes(needle)) {
    return {
      quote: doc.text.trim(),
      startMs: null,
      endMs: null,
      sourceIndex: -1,
      raw: doc.text.trim()
    };
  }

  return null;
}

// Resolve many quotes at once. Quotes that fail to resolve are dropped — the
// caller decides whether that's a grounding failure.
export function evidenceForQuotes(doc: TranscriptDocument, quotes: string[]): EvidenceMap {
  const evidence: Evidence[] = [];
  for (const q of quotes) {
    const e = evidenceForQuote(doc, q);
    if (e) evidence.push(e);
  }
  return { provenance: provenanceOf(doc), evidence };
}

// True when a quote can be pinned to a source location (segment timestamps) —
// the strict subset of evidence the evaluator should treat as grounded.
export function isPinned(e: Evidence): boolean {
  return e.sourceIndex >= 0 && e.startMs !== null && e.endMs !== null;
}

// ── internals ──────────────────────────────────────────────────────────────

function findSegmentContaining(segments: TranscriptSegment[], needle: string): number {
  for (let i = 0; i < segments.length; i++) {
    if (normalizeText(segments[i].text).includes(needle)) return i;
  }
  return -1;
}
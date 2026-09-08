// Content extraction for the file-backed intake kinds (pure, no I/O).
//
// Extractors take the raw bytes of a file and produce the canonical content
// shape: text + detected structure + metadata. PDF/DOCX and real image
// understanding need external engines; those adapters expose an injectable
// extractor seam whose *default* is an honest "not wired up yet" — the content
// is never fabricated. TXT and Markdown extractors are real and dependency-free.

import type { SourceKind } from "./registry";

export type ContentBlockType = "heading" | "paragraph" | "list" | "quote" | "code";

export interface ContentBlock {
  type: ContentBlockType;
  text: string;
  level?: number; // heading depth (1-6, markdown), else undefined
}

export interface ExtractedStructure {
  blocks: ContentBlock[];
}

export interface ExtractedMetadata {
  [key: string]: string | number | boolean | null;
}

export interface ExtractedContent {
  kind: SourceKind;
  text: string; // canonical, trimmed
  structure: ExtractedStructure | null;
  metadata: ExtractedMetadata;
  // Image understanding is deferred when true: text is empty by design and the
  // adapter must not fabricate content about the image.
  deferred?: boolean;
  deferReason?: string;
}

export interface ExtractInput {
  bytes: Uint8Array;
  fileName: string;
  extension: string;
  mimeType: string | null;
}

export type ContentExtractor = (input: ExtractInput) => Promise<ExtractedContent> | ExtractedContent;

// ── text decoding ───────────────────────────────────────────────────────────

export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

// ── structure detection ────────────────────────────────────────────────────

const HEADING = /^(#{1,6})\s+(.+)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;
const QUOTE = /^\s*>/;
const CODE_FENCE = /^\s*(```|~~~)/;
const HORIZONTAL_RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

export function detectStructure(text: string, format: "plain" | "markdown"): ExtractedStructure {
  if (format === "plain") {
    return { blocks: plainBlocks(text) };
  }
  return markdownBlocks(text);
}

function plainBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const paragraph of text.split(/\n\s*\n+/)) {
    const clean = paragraph.replace(/\s+/g, " ").trim();
    if (clean) blocks.push({ type: "paragraph", text: clean });
  }
  return blocks;
}

function markdownBlocks(text: string): ExtractedStructure {
  const blocks: ContentBlock[] = [];
  let buffer: string[] = [];
  let inCode = false;
  const flushParagraph = () => {
    const joined = buffer.join(" ").replace(/\s+/g, " ").trim();
    buffer = [];
    if (joined) blocks.push({ type: "paragraph", text: joined });
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/g, "");

    if (CODE_FENCE.test(line)) {
      inCode = !inCode;
      flushParagraph();
      continue;
    }
    if (inCode) {
      // Code text is preserved verbatim (trimmed trailer only) — the LLM
      // downstream wants the exact snippet, not a whitespace-collapsed one.
      blocks.push({ type: "code", text: line.trim() });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", text: heading[2].trim(), level: heading[1].length });
      continue;
    }
    if (LINE_QUOTE.test(line)) {
      flushParagraph();
      blocks.push({ type: "quote", text: line.replace(QUOTE, "").trim() });
      continue;
    }
    if (listish(line)) {
      flushParagraph();
      blocks.push({ type: "list", text: line.trim() });
      continue;
    }
    if (!line.trim() || HORIZONTAL_RULE.test(line)) {
      flushParagraph();
      continue;
    }
    buffer.push(line.trim());
  }
  flushParagraph();
  return { blocks };
}

function listish(line: string): boolean {
  return LIST_ITEM.test(line.trim());
}

const LINE_QUOTE = /^\s*>/;

export function structureHeadings(structure: ExtractedStructure): { level: number; text: string }[] {
  return structure.blocks.filter((b) => b.type === "heading").map((b) => ({ level: b.level ?? 0, text: b.text }));
}

// ── real extractors: text kinds ─────────────────────────────────────────────

export function extractPlainText(input: ExtractInput): ExtractedContent {
  const text = decodeText(input.bytes).trim();
  return {
    kind: "txt",
    text,
    structure: text ? detectStructure(text, "plain") : null,
    metadata: { bytes: input.bytes.byteLength, characters: text.length, language: null }
  };
}

export function extractMarkdown(input: ExtractInput): ExtractedContent {
  const text = decodeText(input.bytes).trim();
  return {
    kind: "markdown",
    text,
    structure: text ? detectStructure(text, "markdown") : null,
    metadata: { bytes: input.bytes.byteLength, characters: text.length, language: null }
  };
}

// ── extractor seams: engines are injected, never faked ─────────────────────

type SeamKind = "pdf" | "docx" | "image";
const NOT_WIRED: Record<SeamKind, string> = {
  pdf: "PDF text extraction is not wired up yet — install a PDF extractor into the pdf adapter and re-ingest; nothing was assumed about the document contents.",
  docx: "Word (DOCX) extraction is not wired up yet — install a DOCX extractor into the docx adapter and re-ingest; nothing was assumed about the document contents.",
  image:
    "Image understanding (OCR/vision) is deferred to the analyzing stage — this provider never guesses what an image contains."
};

export function makeExtractorSeam(kind: SeamKind, impl?: ContentExtractor): ContentExtractor {
  if (impl) return impl;
  return async () => {
    throw new Error(NOT_WIRED[kind]);
  };
}

export const makePdfExtractor = (impl?: ContentExtractor): ContentExtractor =>
  makeExtractorSeam("pdf", impl);
export const makeDocxExtractor = (impl?: ContentExtractor): ContentExtractor =>
  makeExtractorSeam("docx", impl);
export const makeImageExtractor = (impl?: ContentExtractor): ContentExtractor =>
  makeExtractorSeam("image", impl);
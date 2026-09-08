// Real extraction engines for the file-backed intake kinds. Server-only.
//
// This module pulls in Node-only packages (pdf-parse, mammoth) and lazily
// constructs the Gemini vision client inside the image extractor, so importing
// it never requires an API key — only calling the image engine does. The pure
// seam in ./extract stays dependency-free and testable; ./index.ts plugs these
// engines in where the default "not wired up yet" used to live. Extraction is
// always real: a PDF without a text layer, or an image without visible text,
// yields honest empty content that the adapters' ensureMeaningful guard rejects
// rather than fabricating anything.

// Import the parser entry (lib/pdf-parse.js) instead of the package root: the
// root index.js runs a self-test that reads `test/data/*.pdf` whenever
// `module.parent` is falsy — true under vite-node/ESM transforms, where it
// crashes with ENOENT. The lib entry has no such side effect.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { extractRawText } from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryOnOverload } from "@/lib/ai/retry";
import { detectStructure, type ContentExtractor, type ExtractedContent } from "./extract";

export const PDF_MODEL = "gemini-3.6-flash";

// Map a file extension onto the MIME Gemini's inline-data part needs. Anything
// unknown falls back to a generic image MIME — the file-gate already whitelisted
// the supported image extensions the moment it let the source through.
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif"
};

// ── PDF ────────────────────────────────────────────────────────────────────

export const pdfExtractor: ContentExtractor = async ({ bytes }) => {
  const result = await retryOnOverload(() => pdfParse(Buffer.from(bytes)));
  // pdf-parse emits U+0000 padding in some page runs; strip before canonical
  // shaping so empty-looking pages don't smuggle NUL bytes downstream.
  const text = String(result?.text ?? "").replace(/\u0000/g, "").trim();
  return {
    kind: "pdf",
    text,
    structure: text ? detectStructure(text, "plain") : null,
    metadata: {
      bytes: bytes.byteLength,
      characters: text.length,
      pages: result?.numpages ?? null,
      language: null
    }
  };
};

// ── DOCX ───────────────────────────────────────────────────────────────────

export const docxExtractor: ContentExtractor = async ({ bytes }) => {
  const result = await extractRawText({ buffer: Buffer.from(bytes) });
  const text = String(result?.value ?? "").trim();
  return {
    kind: "docx",
    text,
    structure: text ? detectStructure(text, "plain") : null,
    metadata: { bytes: bytes.byteLength, characters: text.length, language: null }
  };
};

// ── Image (Gemini vision) ──────────────────────────────────────────────────

const IMAGE_ANALYSIS_PROMPT = `You are the analysis stage of a content repurposing engine. Analyze the image and return exactly these three sections, strictly grounded in what is visible in the image:

## Visible text
Transcribe every word visible in the image in reading order, exactly as written. If there is no readable text, write exactly: NONE

## Description
Describe factually what is displayed: subject, layout, medium, people, objects, charts/statistics as presented. Report only what is actually visible. Never infer intent and never add facts that cannot be seen.

## Key messages
List the key points, claims, numbers, or data shown in the image, one per line starting with "- ". If nothing is captured, write exactly: NONE`;

export interface ImageAnalysis {
  visibleText: string | null;
  description: string;
  keyMessages: string[];
}

const SECTION =
  /^\s*#{1,6}\s*([^#\n]+)\s*$/;
const NONE = /^\s*NONE\s*$/i;

// Shape the model's markdown-ish answer into a typed analysis. Pure so the
// parser is unit-testable without a vision call.
export function parseImageAnalysis(raw: string): ImageAnalysis {
  let current = "description" as "visibleText" | "description" | "keyMessages";
  const visible: string[] = [];
  const keywords: string[] = [];
  const descriptionLines: string[] = [];

  for (const line of String(raw ?? "").split("\n")) {
    const match = line.match(SECTION);
    if (match) {
      const title = match[1].toLowerCase();
      if (/visible/i.test(title)) current = "visibleText";
      else if (/description|overview|summary/i.test(title)) current = "description";
      else if (/key message|key point/i.test(title)) current = "keyMessages";
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    // "NONE" is the model's explicit "nothing here" marker per section — it
    // must not become content.
    if (NONE.test(trimmed)) continue;
    if (current === "visibleText") visible.push(trimmed);
    else if (current === "keyMessages") keywords.push(trimmed.replace(/^\s*[-*•]\s*/, ""));
    else descriptionLines.push(trimmed);
  }

  const visibleText = visible.length ? visible.join("\n") : null;
  return {
    visibleText,
    description: descriptionLines.join(" ").trim(),
    keyMessages: keywords
  };
}

// Canonical image text: the model's word-for-word transcription first (grounded
// OCR), then a factual description and any visibly-shown messages. When nothing
// is visible, the text stays empty and ensureMeaningful rejects it honestly.
export function imageTextFromAnalysis(a: ImageAnalysis): string {
  const parts: string[] = [];
  if (a.visibleText) {
    parts.push("## Visible text", a.visibleText);
  }
  if (a.description) {
    parts.push("## Description", a.description);
  }
  if (a.keyMessages.length) {
    parts.push("## Key messages", a.keyMessages.map((k) => `- ${k}`).join("\n"));
  }
  return parts.join("\n\n").trim();
}

let _genAI: GoogleGenerativeAI | null = null;
function visionModel(modelName: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Image understanding needs the GEMINI_API_KEY, which isn't set.");
  }
  _genAI ??= new GoogleGenerativeAI(key);
  return _genAI.getGenerativeModel({ model: modelName });
}

export interface ImageEngineOptions {
  model?: string;
}

// Factory so an alternative model can be injected in tests/config; the default
// export is the wired-in engine. The extractor constructs its model lazily on
// first call so importing engines never requires an API key.
export function createImageExtractor(opts: ImageEngineOptions = {}): ContentExtractor {
  const modelName = opts.model ?? PDF_MODEL;
  return async ({ bytes, extension }) => {
    const mime = IMAGE_MIME[extension?.toLowerCase() ?? ""] ?? imageMimeFallback(extension);
    const result = await retryOnOverload(() =>
      lazyModel(modelName).generateContent([
        IMAGE_ANALYSIS_PROMPT,
        { inlineData: { data: Buffer.from(bytes).toString("base64"), mimeType: mime } }
      ])
    );
    const analysis = parseImageAnalysis(result.response.text());
    const text = imageTextFromAnalysis(analysis);
    return {
      kind: "image",
      text,
      structure: text ? detectStructure(text, "markdown") : null,
      metadata: {
        bytes: bytes.byteLength,
        characters: text.length,
        hasVisibleText: analysis.visibleText != null,
        language: null
      }
    };
  };
}

function imageMimeFallback(extension: string | undefined): string {
  return extension?.toLowerCase() === "gif" ? "image/gif" : "image/jpeg";
}

let _lazyModels: Record<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>> = {};
function lazyModel(modelName: string) {
  _lazyModels[modelName] ??= visionModel(modelName);
  return _lazyModels[modelName];
}

export const imageExtractor: ContentExtractor = createImageExtractor();

// Re-export the shapes extractor callers share so a single entry point exists.
export type { ExtractedContent };
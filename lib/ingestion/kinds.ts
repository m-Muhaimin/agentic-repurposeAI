// Per-kind intake rules for the file-backed ingestion kinds (pure, no I/O).
//
// Each new intake kind (pdf, docx, markdown, txt, srt, vtt, image) gets a
// strict extension allowlist + size cap + reported-MIME expectation, mirroring
// the media gates lib/limits.ts already enforces for uploads. Like upload.ts,
// there is no magic-byte sniffing (the object's own metadata is the boundary);
// text kinds additionally reject NUL bytes so a binary file can't masquerade
// as a transcript. Unknown MIME (empty / application/octet-stream) is allowed
// through the extension gate, exactly like upload.ts treats a missing MIME.

import { fileExtension, formatBytes, MAX_SOURCE_FILE_BYTES } from "@/lib/limits";
import type { SourceKind } from "./registry";

export type FileBackedKind = "txt" | "srt" | "vtt" | "markdown" | "pdf" | "docx" | "image";

interface KindRule {
  // Strict extension allowlist — the primary gate.
  readonly extensions: readonly string[];
  // What the object's reported MIME may look like (empty/octet-stream always
  // pass through so a browser that reports nothing isn't blocked).
  readonly mimePattern: RegExp;
  readonly maxBytes: number;
  readonly label: string;
}

// All file-backed kinds share the exact media upload cap (MAX_SOURCE_FILE_BYTES)
// so nothing is accepted here that upload.ts would reject for media.
const MAX = MAX_SOURCE_FILE_BYTES;

export const KIND_RULES: Record<FileBackedKind, KindRule> = {
  txt: {
    extensions: ["txt"],
    mimePattern: /^text\//i,
    maxBytes: MAX,
    label: "text file"
  },
  srt: {
    extensions: ["srt"],
    mimePattern: /^(text\/|application\/x-subrip)/i,
    maxBytes: MAX,
    label: "SubRip subtitle file"
  },
  vtt: {
    extensions: ["vtt"],
    mimePattern: /^text\//i,
    maxBytes: MAX,
    label: "WebVTT subtitle file"
  },
  markdown: {
    extensions: ["md", "markdown"],
    mimePattern: /^text\//i,
    maxBytes: MAX,
    label: "Markdown file"
  },
  pdf: {
    extensions: ["pdf"],
    mimePattern: /^application\/pdf$/i,
    maxBytes: MAX,
    label: "PDF document"
  },
  docx: {
    extensions: ["docx"],
    mimePattern: /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/i,
    maxBytes: MAX,
    label: "Word (DOCX) document"
  },
  image: {
    extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "heif", "avif"],
    mimePattern: /^image\//i,
    maxBytes: MAX,
    label: "image"
  }
};

export function kindForExtension(ext: string): FileBackedKind | null {
  const e = ext.toLowerCase().replace(/^\./, "");
  for (const [kind, rule] of Object.entries(KIND_RULES)) {
    if ((rule.extensions as readonly string[]).includes(e)) return kind as FileBackedKind;
  }
  return null;
}

export function resolveFileKind(pathOrName: string): FileBackedKind | null {
  return kindForExtension(fileExtension(pathOrName));
}

export function extensionsFor(kind: FileBackedKind): readonly string[] {
  return KIND_RULES[kind].extensions;
}

export function maxBytesFor(kind: FileBackedKind): number {
  return KIND_RULES[kind].maxBytes;
}

export function isAllowedKindMime(kind: FileBackedKind, mime: string | null | undefined): boolean {
  if (!mime) return true;
  if (/^application\/octet-stream$/i.test(mime)) return true;
  return KIND_RULES[kind].mimePattern.test(mime);
}

// Binary-as-text guard for the text kinds: any NUL byte inside the sampled head
// means this is not plain text even though the extension claims it is.
export function assertTextualSample(bytes: Uint8Array): boolean {
  const head = bytes.length > 4096 ? bytes.subarray(0, 4096) : bytes;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === 0) return false;
  }
  return true;
}

export interface FileValidation {
  ok: boolean;
  kind: FileBackedKind | null;
  errors: string[];
}

const ALL_EXTENSIONS = (Object.values(KIND_RULES).flatMap((r) => r.extensions) as string[]).sort();

// Validate a file descriptor the way the worker gates uploads: extension first,
// then size, then the reported MIME. sizeBytes/mimeType are optional because
// adapters validate in two passes — a cheap extension pass at dispatch, then a
// full pass once storage metadata is known. Errors are human + actionable.
export function validateFile(input: {
  fileName: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}): FileValidation {
  const ext = fileExtension(input.fileName ?? "");
  const kind = kindForExtension(ext);
  const errors: string[] = [];

  if (!kind) {
    errors.push(
      `Unsupported file type ".${ext}". Supported extensions: ${ALL_EXTENSIONS.join(", ")}.`
    );
    return { ok: false, kind: null, errors };
  }

  if (input.sizeBytes != null && input.sizeBytes > KIND_RULES[kind].maxBytes) {
    errors.push(
      `This ${KIND_RULES[kind].label} (${formatBytes(input.sizeBytes)}) is larger than the ${Math.round(
        KIND_RULES[kind].maxBytes / (1024 * 1024)
      )} MB limit.`
    );
  }

  if (input.mimeType != null && !isAllowedKindMime(kind, input.mimeType)) {
    const article = /^[aeiou]/i.test(KIND_RULES[kind].label) ? "an" : "a";
    errors.push(`"${input.mimeType}" doesn't look like ${article} ${KIND_RULES[kind].label}.`);
  }

  return { ok: errors.length === 0, kind, errors };
}
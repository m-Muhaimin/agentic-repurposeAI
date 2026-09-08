// Shared file I/O for the file-backed providers: read the stored object's
// metadata (size + reported MIME), gate it against the per-kind rules, then
// download the bytes. Mirrors the order upload.ts uses (metadata gate before
// spending any downstream quota) and surfaces every failure as an
// IngestionFailure with a human reason — never a raw stack.

import { validateFile, assertTextualSample } from "./kinds";
import { ingestionFailure, toFailReason } from "./failure";
import type { IngestionContext } from "./types";

export interface GatedFile {
  bytes: Uint8Array;
  sizeBytes: number;
  mimeType: string | null;
  fileName: string;
}

export interface ReadOptions {
  // Text kinds additionally reject NUL bytes so a binary file can't sail
  // through on a forged .txt/.srt/.vtt extension.
  textOnly?: boolean;
}

export async function readAndValidateFile(
  ctx: IngestionContext,
  storagePath: string,
  opts: ReadOptions = {}
): Promise<GatedFile> {
  const fileName = (storagePath.split("/").pop() ?? storagePath) || storagePath;
  const { data: obj, error: infoErr } = await ctx.service.storage.from("sources").info(storagePath);
  if (infoErr) {
    throw ingestionFailure("Could not read the uploaded file metadata.", {
      why: toFailReason(infoErr),
      nextStep: "Make sure the file is still in your Content Library and try again."
    });
  }
  const meta = (obj?.metadata ?? {}) as Record<string, unknown>;
  const sizeBytes = Number(meta.size ?? meta.contentLength ?? 0);

  // Strict extension + size + MIME gate before any bytes are downloaded.
  const validation = validateFile({ fileName, sizeBytes, mimeType: String(meta.mimetype ?? "") });
  if (!validation.ok) {
    throw ingestionFailure(validation.errors.join(" "), {
      nextStep: "Choose a supported file type and size, then re-upload."
    });
  }

  const { data: blob, error: dlErr } = await ctx.service.storage
    .from("sources")
    .download(storagePath);
  if (dlErr) {
    throw ingestionFailure("Could not download the source file.", {
      why: toFailReason(dlErr),
      nextStep: "Try again in a moment."
    });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (opts.textOnly && !assertTextualSample(bytes)) {
    throw ingestionFailure("This file looks like binary data rather than text.", {
      nextStep: "Check the file extension — binary files can't be read as a transcript."
    });
  }

  return { bytes, sizeBytes, mimeType: String(meta.mimetype ?? ""), fileName };
}
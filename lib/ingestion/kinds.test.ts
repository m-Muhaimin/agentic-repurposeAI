// Phase 2: per-kind file rules — extension/MIME/size validation, kind mapping.

import { describe, expect, it } from "vitest";
import {
  KIND_RULES,
  assertTextualSample,
  extensionsFor,
  isAllowedKindMime,
  kindForExtension,
  maxBytesFor,
  resolveFileKind,
  validateFile
} from "@/lib/ingestion/kinds";

describe("kindForExtension", () => {
  it("maps every allowed extension to its kind (case-insensitive)", () => {
    expect(kindForExtension("pdf")).toBe("pdf");
    expect(kindForExtension("PDF")).toBe("pdf");
    expect(kindForExtension(".pdf")).toBe("pdf");
    expect(kindForExtension("docx")).toBe("docx");
    expect(kindForExtension("md")).toBe("markdown");
    expect(kindForExtension("markdown")).toBe("markdown");
    expect(kindForExtension("txt")).toBe("txt");
    expect(kindForExtension("srt")).toBe("srt");
    expect(kindForExtension("vtt")).toBe("vtt");
    expect(kindForExtension("png")).toBe("image");
    expect(kindForExtension("jpg")).toBe("image");
    expect(kindForExtension("jpeg")).toBe("image");
    expect(kindForExtension("gif")).toBe("image");
    expect(kindForExtension("webp")).toBe("image");
    expect(kindForExtension("bmp")).toBe("image");
    expect(kindForExtension("heic")).toBe("image");
  });

  it("rejects extensions outside the allowlists", () => {
    for (const ext of ["exe", "mov", "mp3", "zip", "html", "json", "", "???"]) {
      expect(kindForExtension(ext)).toBeNull();
    }
  });

  it("resolveFileKind derives the kind from a full path", () => {
    expect(resolveFileKind("u1/notes.md")).toBe("markdown");
    expect(resolveFileKind("u1/a/b/scan.PDF")).toBe("pdf");
    expect(resolveFileKind("u1/meeting.vtt")).toBe("vtt");
    expect(resolveFileKind("u1/blob.bin")).toBeNull();
  });
});

describe("validateFile", () => {
  it("accepts a valid pdf with matching size and MIME", () => {
    const v = validateFile({
      fileName: "doc.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf"
    });
    expect(v.ok).toBe(true);
    expect(v.kind).toBe("pdf");
    expect(v.errors).toEqual([]);
  });

  it("accepts each kind on extension alone when MIME/size are unknown", () => {
    for (const kind of Object.keys(KIND_RULES)) {
      const fileName = `x.${extensionsFor(kind as keyof typeof KIND_RULES)[0]}`;
      expect(validateFile({ fileName }).ok).toBe(true);
    }
  });

  it("rejects unknown extensions with an actionable error", () => {
    const v = validateFile({ fileName: "virus.exe", sizeBytes: 10, mimeType: null });
    expect(v.ok).toBe(false);
    expect(v.kind).toBeNull();
    expect(v.errors.join(" ")).toContain("Unsupported file type");
    expect(v.errors.join(" ")).toContain("pdf");
  });

  it("rejects files over the per-kind size cap", () => {
    const v = validateFile({
      fileName: "huge.doc.pdf",
      sizeBytes: 300 * 1024 * 1024,
      mimeType: "application/pdf"
    });
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toContain("200 MB limit");
  });

  it("rejects a MIME that contradicts the kind", () => {
    const p = validateFile({ fileName: "a.pdf", sizeBytes: 10, mimeType: "image/png" });
    expect(p.ok).toBe(false);
    expect(p.errors.join(" ")).toContain("doesn't look like a PDF");

    const t = validateFile({ fileName: "notes.txt", sizeBytes: 10, mimeType: "video/mp4" });
    expect(t.ok).toBe(false);
    expect(t.errors.join(" ")).toContain("doesn't look like a text file");
  });

  it("treats empty/octet-stream MIME as unknown and lets the extension govern", () => {
    expect(validateFile({ fileName: "notes.txt", sizeBytes: 10, mimeType: "" }).ok).toBe(true);
    expect(
      validateFile({ fileName: "scan.pdf", sizeBytes: 10, mimeType: "application/octet-stream" }).ok
    ).toBe(true);
  });

  it("keeps every size limit at or under the media upload cap (never weaker)", () => {
    for (const rule of Object.values(KIND_RULES)) {
      expect(rule.maxBytes).toBeLessThanOrEqual(200 * 1024 * 1024);
    }
  });
});

describe("assertTextualSample", () => {
  it("accepts plain text bytes", () => {
    expect(assertTextualSample(new TextEncoder().encode("hello transcript\nsecond line"))).toBe(true);
  });

  it("rejects binary data carrying a NUL byte", () => {
    expect(assertTextualSample(new Uint8Array([0x00, 0x01, 0x02]))).toBe(false);
    const big = new Uint8Array(5000).fill(65);
    big[100] = 0;
    expect(assertTextualSample(big)).toBe(false);
  });
});

describe("helpers", () => {
  it("exposes bounds per kind", () => {
    expect(maxBytesFor("image")).toBeGreaterThan(0);
    expect(extensionsFor("docx")).toEqual(["docx"]);
  });

  it("mime allowlist honours empty/unknown and type families", () => {
    expect(isAllowedKindMime("image", "image/png")).toBe(true);
    expect(isAllowedKindMime("image", "image/svg+xml")).toBe(true);
    expect(isAllowedKindMime("image", "text/plain")).toBe(false);
    expect(isAllowedKindMime("pdf", "")).toBe(true);
    expect(isAllowedKindMime("pdf", "application/octet-stream")).toBe(true);
    expect(isAllowedKindMime("srt", "application/x-subrip")).toBe(true);
    expect(isAllowedKindMime("srt", "text/plain")).toBe(true);
    expect(isAllowedKindMime("vtt", "video/mp4")).toBe(false);
  });
});
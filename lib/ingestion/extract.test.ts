// Phase 2: extraction — real TXT/Markdown extractors + pdf/docx/image seams.

import { describe, expect, it } from "vitest";
import {
  decodeText,
  detectStructure,
  extractMarkdown,
  extractPlainText,
  makeDocxExtractor,
  makeImageExtractor,
  makePdfExtractor,
  structureHeadings
} from "@/lib/ingestion/extract";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("decodeText", () => {
  it("decodes utf-8 and strips a leading BOM", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("hello")]);
    expect(decodeText(bom)).toBe("hello");
  });
});

describe("extractPlainText", () => {
  it("returns trimmed text + paragraph structure + metadata", () => {
    const out = extractPlainText({
      bytes: bytes("First paragraph.\n\nSecond paragraph.\n"),
      fileName: "notes.txt",
      extension: "txt",
      mimeType: "text/plain"
    });
    expect(out.kind).toBe("txt");
    expect(out.text).toBe("First paragraph.\n\nSecond paragraph.");
    expect(out.structure?.blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    expect(out.metadata.bytes).toBeGreaterThan(0);
    expect(out.metadata.characters).toBe(out.text.length);
  });

  it("collapses internal whitespace within a paragraph", () => {
    const out = extractPlainText({ bytes: bytes("a   b\nc"), fileName: "n.txt", extension: "txt", mimeType: null });
    expect(out.structure?.blocks[0].text).toBe("a b c");
  });

  it("returns no structure for empty input", () => {
    const out = extractPlainText({ bytes: bytes("   \n "), fileName: "n.txt", extension: "txt", mimeType: null });
    expect(out.text).toBe("");
    expect(out.structure).toBeNull();
  });
});

describe("extractMarkdown", () => {
  const MD = [
    "# Hello",
    "",
    "Intro paragraph with **bold**.",
    "",
    "- item one",
    "- item two",
    "",
    "> a quoted line",
    "",
    "```js",
    "const a = 1;",
    "```",
    "",
    "## Section two",
    "",
    "Trailing paragraph."
  ].join("\n");

  it("detects headings, lists, quotes, code and paragraphs in order", () => {
    const out = extractMarkdown({ bytes: bytes(MD), fileName: "guide.md", extension: "md", mimeType: "text/markdown" });
    expect(out.kind).toBe("markdown");
    const types = out.structure?.blocks.map((b) => b.type) ?? [];
    expect(types).toEqual(["heading", "paragraph", "list", "list", "quote", "code", "heading", "paragraph"]);
    expect(structureHeadings(out.structure!)).toContainEqual({ level: 1, text: "Hello" });
    expect(structureHeadings(out.structure!)).toContainEqual({ level: 2, text: "Section two" });
    expect(out.structure?.blocks.find((b) => b.type === "code")?.text).toBe("const a = 1;");
  });

  it("keeps the full source text (markdown preserved) for downstream LLMs", () => {
    const out = extractMarkdown({ bytes: bytes(MD), fileName: "guide.md", extension: "md", mimeType: null });
    expect(out.text).toContain("# Hello");
    expect(out.text).toContain("const a = 1;");
  });
});

describe("detectStructure", () => {
  it("plain format never invents headings", () => {
    const s = detectStructure("# Not a heading in plain text", "plain");
    expect(s.blocks.every((b) => b.type !== "heading")).toBe(true);
  });
});

describe("extractor seams", () => {
  it("pdf default is an honest 'not wired up' rejection, no content invented", async () => {
    const seam = makePdfExtractor();
    await expect(
      seam({ bytes: bytes("%PDF-1.7 fake"), fileName: "a.pdf", extension: "pdf", mimeType: "application/pdf" })
    ).rejects.toThrow(/PDF text extraction is not wired up yet/);
  });

  it("docx default is an honest 'not wired up' rejection", async () => {
    const seam = makeDocxExtractor();
    await expect(
      seam({ bytes: bytes("PK fake"), fileName: "a.docx", extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    ).rejects.toThrow(/Word \(DOCX\) extraction is not wired up yet/);
  });

  it("pdf/docx/image seams accept an injected engine", async () => {
    const fake = async (input: { fileName: string }) => ({
      kind: "pdf" as const,
      text: `parsed ${input.fileName}`,
      structure: null,
      metadata: {}
    });
    const seam = makePdfExtractor(fake);
    const out = await seam({ bytes: bytes("x"), fileName: "a.pdf", extension: "pdf", mimeType: null });
    expect(out.text).toBe("parsed a.pdf");
  });

  it("image default defers honestly and never fabricates facts", async () => {
    const seam = makeImageExtractor();
    await expect(
      seam({ bytes: bytes("fake-png"), fileName: "a.png", extension: "png", mimeType: "image/png" })
    ).rejects.toThrow(/never guesses what an image contains/);
  });
});
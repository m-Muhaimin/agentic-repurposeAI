import { describe, it, expect, afterEach } from "vitest";
import {
  pdfExtractor,
  docxExtractor,
  imageExtractor,
  createImageExtractor,
  parseImageAnalysis,
  imageTextFromAnalysis,
  type ImageAnalysis
} from "./engines";

const originalKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe("parseImageAnalysis", () => {
  it("parses the three sections into typed analysis", () => {
    const raw = [
      "## Visible text",
      "REPURPOSE FAST",
      "Build once, ship everywhere",
      "## Description",
      "A slide with a bold headline and one supporting line of text.",
      "## Key messages",
      "- Building in public compounds",
      "- Start with the transcript"
    ].join("\n");

    const analysis = parseImageAnalysis(raw);
    expect(analysis.visibleText).toContain("REPURPOSE FAST");
    expect(analysis.description).toContain("bold headline");
    expect(analysis.keyMessages).toEqual([
      "Building in public compounds",
      "Start with the transcript"
    ]);
  });

  it("treats a NONE marker as empty, never as content", () => {
    const analysis = parseImageAnalysis(
      "## Visible text\nNONE\n## Description\nA photo of a coastline at dusk.\n## Key messages\nNONE"
    );
    expect(analysis.visibleText).toBeNull();
    expect(analysis.keyMessages).toEqual([]);
    expect(analysis.description).toContain("coastline");
  });

  it("handles missing sections and stray bullets", () => {
    const analysis = parseImageAnalysis(
      "# Description\n- A chart comparing two bars, no labels."
    );
    expect(analysis.keyMessages).toEqual([]);
    expect(analysis.description).toContain("chart");
    expect(analysis.description.startsWith("- ")).toBe(true);
  });
});

describe("imageTextFromAnalysis", () => {
  it("assembles canonical text with markdown section headings", () => {
    const analysis: ImageAnalysis = {
      visibleText: "Hello world",
      description: "A sign reading hello world.",
      keyMessages: ["The core message."]
    };
    const text = imageTextFromAnalysis(analysis);
    expect(text).toContain("## Visible text");
    expect(text).toContain("Hello world");
    expect(text).toContain("## Description");
    expect(text).toContain("## Key messages");
    expect(text).toContain("- The core message.");
  });

  it("returns empty text when nothing was visible", () => {
    expect(imageTextFromAnalysis({ visibleText: null, description: "", keyMessages: [] })).toBe("");
  });
});

describe("engine wiring", () => {
  it("exposes the three wired-in extractors", () => {
    expect(pdfExtractor).toBeTypeOf("function");
    expect(docxExtractor).toBeTypeOf("function");
    expect(imageExtractor).toBeTypeOf("function");
  });

  it("pdf on garbage bytes rejects asynchronously (real engine contract)", async () => {
    const task = pdfExtractor({
      bytes: new Uint8Array(4),
      fileName: "x.pdf",
      extension: "pdf",
      mimeType: "application/pdf"
    });
    expect(task).toBeInstanceOf(Promise);
    await expect(task).rejects.toBeTruthy();
  });

  it("createImageExtractor defers the key requirement to call time, not import", async () => {
    delete process.env.GEMINI_API_KEY;
    const extractor = createImageExtractor({ model: "unused-model-test-gk" });
    await expect(
      extractor({ bytes: new Uint8Array(8), fileName: "a.png", extension: "png", mimeType: "image/png" })
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
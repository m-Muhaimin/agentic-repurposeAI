import { describe, it, expect } from "vitest";
import { exportOutput, EXPORT_MIME } from "@/lib/export";
import type { OutputFormat } from "@/lib/ai/prompts";

// The five first-class formats from lib/ai/prompts.ts (read-only contract).
const FORMATS: OutputFormat[] = [
  "linkedin_post",
  "newsletter",
  "shortform_script",
  "thread",
  "carousel"
];

// Local date stamp the filename embeds — computed the same way exportOutput does.
const now = new Date();
const expectedStamp = [
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0")
].join("-");

describe("exportOutput (per-format table)", () => {
  it.each(FORMATS)("exports %s content as-is with slug+date filename and markdown mime", (format) => {
    const content = "# Heading\n\nBody text for the draft.";
    const file = exportOutput(content, format);

    // slug = format with underscores → dashes (e.g. linkedin_post → linkedin-post).
    const slug = format.replace(/_/g, "-");
    expect(file.filename).toBe(`${slug}-${expectedStamp}.md`);
    expect(file.content).toBe(content);
    expect(file.mime).toBe("text/markdown");
    expect(file.mime).toBe(EXPORT_MIME);
  });

  it("passes multi-line output through unchanged", () => {
    const content = "Line one.\n\nLine two with **markdown**.\n- bullet";
    const file = exportOutput(content, "thread");
    expect(file.content).toBe(content);
  });
});
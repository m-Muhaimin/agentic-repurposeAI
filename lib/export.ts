// Pure export helpers for the draft editor — no DOM, no fetch, no env, so it
// stays unit-testable. `exportOutput` turns an output draft into a downloadable
// markdown file descriptor; the editor (components/output-editor.tsx) owns the
// Blob/anchor plumbing.

import type { OutputFormat } from "@/lib/ai/prompts";

export interface ExportFile {
  filename: string;
  content: string;
  mime: string;
}

// All formats download as markdown.
export const EXPORT_MIME = "text/markdown";

// Filename slug per format (underscores → dashes).
const FILE_SLUGS: Record<OutputFormat, string> = {
  linkedin_post: "linkedin-post",
  newsletter: "newsletter",
  shortform_script: "shortform-script",
  thread: "thread",
  carousel: "carousel"
};

function dateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Builds the downloadable file for an output draft.
 * Filename = format slug + local date, e.g. `linkedin-post-2026-09-12.md`.
 * Content is the output text as-is; mime is `text/markdown` for every format.
 */
export function exportOutput(output: string, format: OutputFormat): ExportFile {
  return {
    filename: `${FILE_SLUGS[format]}-${dateStamp(new Date())}.md`,
    content: output,
    mime: EXPORT_MIME
  };
}
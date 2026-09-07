// Ingestion layer entry point: turn any `sources` row into a canonical
// `TranscriptDocument`. The worker calls exactly one function; every source
// type (YouTube, uploaded media, transcript file) resolves down to the same
// downstream contract.

import { ingestYouTube } from "./youtube";
import { ingestUploadedMedia } from "./upload";
import { ingestTranscript } from "./transcript";
import { saveTranscript } from "./save";
import type { IngestSource, IngestionContext, TranscriptDocument } from "./types";

export type {
  IngestSource,
  IngestionContext,
  TranscriptDocument,
  TranscriptSegment,
  IngestionSourceType
} from "./types";

export { saveTranscript };

export async function ingestSource(
  source: IngestSource,
  ctx: IngestionContext
): Promise<TranscriptDocument> {
  switch (source.source_type) {
    case "youtube":
      return ingestYouTube(source, ctx);
    case "audio":
    case "video":
      return ingestUploadedMedia(source, ctx);
    case "transcript":
      return ingestTranscript(source, ctx);
    default:
      throw new Error("Unsupported source type");
  }
}
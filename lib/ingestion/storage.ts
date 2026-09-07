// Shared storage helpers for ingestion providers (signed URLs for media that
// AssemblyAI must fetch, and for YouTube the pulled mp3).

import type { IngestionContext } from "./types";

export async function createSignedUrl(
  ctx: IngestionContext,
  storagePath: string
): Promise<string> {
  const { data: signedUrl } = await ctx.service.storage
    .from("sources")
    .createSignedUrl(storagePath, 3600);
  if (!signedUrl?.signedUrl) {
    throw new Error("Could not create signed URL for source file.");
  }
  return signedUrl.signedUrl;
}
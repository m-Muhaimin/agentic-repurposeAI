// Idempotent file re-ingestion (pure core + store seam).
//
// The same input re-ingested must not duplicate sources or assets. Every
// file-backed provider hashes the raw bytes (sha256) and derives an idempotency
// key from hash + kind + user. A provider that finds an existing source for the
// same (user, source_type, key) reuses that source's canonical transcript
// instead of re-extracting; the schema anchor for the row-level guarantee is
// `sources.content_hash` + the partial unique index added by migration
// 20260908000002. The store seam keeps this module unit-testable without a DB.

import { createHash } from "node:crypto";
import type { IngestSource, IngestionSourceType } from "./types";
import type { SourceKind } from "./registry";

export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function idempotencyKey(kind: SourceKind, hash: string): string {
  return `${kind}:${hash}`;
}

// Minimal lookups a provider needs to decide "have we ingested these bytes
// before, for this user, already producing a transcript?".
export interface ContentStore {
  findSourceByHash(
    userId: string,
    sourceType: IngestionSourceType,
    key: string,
    excludeSourceId?: string
  ): Promise<IngestSource | null>;
  transcriptTextFor(sourceId: string): Promise<string | null>;
  // Persist the computed idempotency key onto a source row so a future ingest of
  // the same bytes/URL can find it. Optional: a store that can't write (or a
  // quick unit fake) just skips write-back — the dedupe is a nicety.
  persistHash?(sourceId: string, key: string): Promise<void>;
}

// Fire-and-forget key persistence for adapters: no-op when the store has no
// write seam, and never fails the job the way a real dedupe-write hiccup could.
export async function persistHashSafely(store: ContentStore | undefined, sourceId: string, key: string): Promise<void> {
  if (!store?.persistHash) return;
  try {
    await store.persistHash(sourceId, key);
  } catch {
    // Dedupe bookkeeping must never fail ingestion.
  }
}

export interface ReuseResult {
  source: IngestSource;
  key: string;
  transcript: string;
}

// Returns a reusable prior ingest for the same bytes/kind/user, or null when
// there is none worth reusing (no matching row, the row *is* this source, or
// the matching source never produced a transcript — in those cases re-ingesting
// is the correct move and creates no duplication).
export async function findReusableSource(
  store: ContentStore,
  source: IngestSource,
  kind: SourceKind,
  hash: string
): Promise<ReuseResult | null> {
  const key = idempotencyKey(kind, hash);
  const existing = await store.findSourceByHash(source.user_id, source.source_type, key, source.id);
  if (!existing) return null;
  const transcript = await store.transcriptTextFor(existing.id);
  if (transcript == null) return null;
  return { source: existing, key, transcript };
}
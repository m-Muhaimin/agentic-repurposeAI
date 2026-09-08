// Supabase-backed ContentStore: turns the ingestion adapters' idempotency seam
// (findSourceByHash / transcriptTextFor) into real lookups against the live
// `sources` table, using migration …0002's `content_hash` column + the
// `sources_user_type_hash_unique` partial index. The worker injects this store
// into the registered providers so identical bytes for the same user + kind
// reuse the earlier transcript instead of re-ingesting.

import type { SupabaseClient } from "@supabase/supabase-js";
import { type ContentStore } from "./idempotency";
import { registerIngestionProvider } from "./registry";
import { documentProvider } from "./document";
import { imageProvider } from "./image";
import { urlProvider } from "./url-adapter";
import { podcastProvider } from "./podcast-adapter";
import { pdfExtractor, docxExtractor, imageExtractor } from "./engines";

// NOTE: `findSourceByHash(userId, sourceType, key, ...)` is the contract the
// adapters already call; it searches by the idempotency key string, not a raw
// hash. This stores the key verbatim in `content_hash` alongside the row so the
// partial unique index can enforce "one source per user+type+key". The key is
// `<kind>:<sha256>` (see idempotency.ts) — length ~70, fits a varchar(255).

export function supabaseContentStore(client: SupabaseClient): ContentStore {
  return {
    async findSourceByHash(userId, sourceType, key, excludeSourceId) {
      let query = client
        .from("sources")
        .select("*")
        .eq("user_id", userId)
        .eq("source_type", sourceType)
        .eq("content_hash", key);
      if (excludeSourceId) query = query.neq("id", excludeSourceId);
      query = query.order("created_at", { ascending: false }).limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`Could not look up reusable source: ${error.message}`);
      return data ?? null;
    },
    async transcriptTextFor(sourceId) {
      const { data, error } = await client
        .from("sources")
        .select("transcript")
        .eq("id", sourceId)
        .maybeSingle();
      if (error) throw new Error(`Could not read prior transcript: ${error.message}`);
      return data?.transcript ?? null;
    },
    async persistHash(sourceId, key) {
      const { error } = await client
        .from("sources")
        .update({ content_hash: key })
        .eq("id", sourceId);
      if (error) throw new Error(`Could not record idempotency key: ${error.message}`);
    }
  };
}

// Re-registers the store-backed variants of the file/url providers. The kinds
// registry is last-wins, so a second registration with a real `store` upgrades
// the adapters used by the worker without touching the pure module-load default.
// Safe to call per worker invocation; the store is idempotent to re-register.
export function registerStoreBackedProviders(store: ContentStore): void {
  registerIngestionProvider(
    documentProvider({ extractors: { pdf: pdfExtractor, docx: docxExtractor }, store })
  );
  registerIngestionProvider(imageProvider({ extractor: imageExtractor, store }));
  registerIngestionProvider(urlProvider({ store }));
  registerIngestionProvider(podcastProvider({ store }));
}
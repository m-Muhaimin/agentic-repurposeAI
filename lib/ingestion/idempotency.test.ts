// Phase 2: idempotency — hashing, keys, and no-duplicate reuse via the store seam.

import { describe, expect, it } from "vitest";
import {
  contentHash,
  findReusableSource,
  idempotencyKey
} from "@/lib/ingestion/idempotency";
import type { IngestSource, IngestionSourceType } from "@/lib/ingestion/types";
import type { ContentStore } from "@/lib/ingestion/idempotency";

const SRC: IngestSource = {
  id: "s-new",
  user_id: "u1",
  source_type: "transcript",
  title: "doc",
  source_url: null,
  storage_path: "u1/doc.pdf"
};

function storeWith(rows: { source: IngestSource; transcript: string | null }[]): ContentStore {
  return {
    async findSourceByHash(userId: string, sourceType: IngestionSourceType, key: string, excludeSourceId?: string) {
      const match = rows.find(
        (r) => r.source.user_id === userId && r.source.source_type === sourceType && r.source.id !== excludeSourceId
      );
      return match ? match.source : null;
    },
    async transcriptTextFor(sourceId: string) {
      return rows.find((r) => r.source.id === sourceId)?.transcript ?? null;
    }
  };
}

describe("contentHash / idempotencyKey", () => {
  it("is deterministic sha256 for identical bytes", () => {
    const a = new TextEncoder().encode("same bytes");
    expect(contentHash(a)).toBe(contentHash(a));
  });

  it("differs for different bytes", () => {
    expect(contentHash(new TextEncoder().encode("one"))).not.toBe(contentHash(new TextEncoder().encode("two")));
  });

  it("scopes the key by kind so same bytes of different kinds never collide", () => {
    expect(idempotencyKey("pdf", "abc")).toBe("pdf:abc");
    expect(idempotencyKey("pdf", "abc")).not.toBe(idempotencyKey("image", "abc"));
  });
});

describe("findReusableSource", () => {
  const prior: IngestSource = { ...SRC, id: "s-prior", storage_path: "u1/doc.pdf" };

  it("returns a reusable prior ingest (same user + source_type + key) with its transcript", async () => {
    const reuse = await findReusableSource(storeWith([{ source: prior, transcript: "prior text" }]), SRC, "pdf", "deadbeef");
    expect(reuse).not.toBeNull();
    expect(reuse?.source.id).toBe("s-prior");
    expect(reuse?.transcript).toBe("prior text");
    expect(reuse?.key).toBe("pdf:deadbeef");
  });

  it("treats a missing row as no reuse (first ingest)", async () => {
    expect(await findReusableSource(storeWith([]), SRC, "pdf", "abc")).toBeNull();
  });

  it("never reuses the source row being ingested itself", async () => {
    const reuse = await findReusableSource(storeWith([{ source: SRC, transcript: "own" }]), SRC, "pdf", "abc");
    expect(reuse).toBeNull();
  });

  it("ignores a matching row that produced no transcript (re-ingesting is correct)", async () => {
    expect(
      await findReusableSource(storeWith([{ source: prior, transcript: null }]), SRC, "pdf", "abc")
    ).toBeNull();
  });
});
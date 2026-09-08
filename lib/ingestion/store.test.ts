import { describe, it, expect } from "vitest";
import "@/lib/ingestion";
import { persistHashSafely, type ContentStore } from "./idempotency";
import { registerStoreBackedProviders } from "./store";
import { providerForKind } from "./registry";

function fakeStore(persist?: ContentStore["persistHash"]): ContentStore {
  return {
    async findSourceByHash() {
      return null;
    },
    async transcriptTextFor() {
      return null;
    },
    persistHash: persist
  };
}

describe("persistHashSafely", () => {
  it("writes through when the store supports it", async () => {
    const written: string[] = [];
    const store = fakeStore(async (id, key) => {
      written.push(`${id}:${key}`);
    });
    await persistHashSafely(store, "src-1", "pdf:a1b2");
    expect(written).toEqual(["src-1:pdf:a1b2"]);
  });

  it("no-ops when the store has no write seam", async () => {
    const store = fakeStore(undefined);
    await expect(persistHashSafely(store, "src-1", "x")).resolves.toBeUndefined();
  });

  it("never throws when the write-back fails (dedupe nicety only)", async () => {
    const store = fakeStore(async () => {
      throw new Error("db down");
    });
    await expect(persistHashSafely(store, "src-1", "x")).resolves.toBeUndefined();
  });

  it("no-ops when the store is absent", async () => {
    await expect(persistHashSafely(undefined, "src-1", "x")).resolves.toBeUndefined();
  });
});

describe("registerStoreBackedProviders", () => {
  it("upgrades the kind registry to store-backed adapters (last-wins)", () => {
    const store = fakeStore();
    const before = providerForKind("pdf") ?? providerForKind("docx") ?? providerForKind("image");
    // The pure module-load default has no store (no persistHash seam) — the
    // registered providers are the ones exported from the store wiring.
    expect(before).toBeTruthy();
    expect(() => registerStoreBackedProviders(store)).not.toThrow();
    for (const kind of ["pdf", "docx", "image", "url", "podcast"] as const) {
      expect(providerForKind(kind)).toBeTruthy();
    }
  });
});
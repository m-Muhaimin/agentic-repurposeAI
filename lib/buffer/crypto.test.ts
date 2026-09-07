// Stage 4 (BYOB) crypto tests: AES-256-GCM roundtrip, ciphertext shape,
// tamper + key-mismatch rejection. The key is a real 32-byte / 64-hex value
// injected per-test because BUFFER_TOKEN_ENCRYPTION_KEY is not present in the
// CI/test environment.

import { describe, expect, it, beforeEach } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/buffer/crypto";

const KEY = "48a7363b1a7879d10a20f7dcccb0102539adbb869b235df85ce900ed7c93a954";

describe("buffer crypto", () => {
  beforeEach(() => {
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY = KEY;
  });

  it("rejects a missing encryption key", () => {
    delete process.env.BUFFER_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSecret("secret")).toThrow("BUFFER_TOKEN_ENCRYPTION_KEY is not set");
  });

  it("rejects a non-64-hex key (enforces raw 256-bit key, no derivation)", () => {
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY = "shortkey";
    expect(() => encryptSecret("secret")).toThrow("exactly 64 hex chars");
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY = "Z".repeat(64);
    expect(() => encryptSecret("secret")).toThrow("exactly 64 hex chars");
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY = KEY;
  });

  it("roundtrips an arbitrary token", () => {
    const plain = "tok_abc123-xyz";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("produces the iv:data:tag hex shape (3 colon-separated parts, all hex)", () => {
    const enc = encryptSecret("hello");
    const parts = enc.split(":");
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(/^[0-9a-f]+$/.test(p)).toBe(true);
  });

  it("produces randomized ciphertext for the same plaintext (fresh iv)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptSecret("integrity");
    const parts = enc.split(":");
    const flipped = `${parts[0]}:${parts[1]}:${parts[2] === "00" ? "ff" : "00"}0`;
    expect(() => decryptSecret(flipped)).toThrow();
  });

  it("rejects malformed ciphertext shape", () => {
    expect(() => decryptSecret("not-valid")).toThrow("Malformed encrypted Buffer token");
  });

  it("fails closed on a key mismatch (undecryptable, not garbage)", () => {
    const enc = encryptSecret("under-key-a");
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY = "99".repeat(32);
    expect(() => decryptSecret(enc)).toThrow();
  });
});
// AES-256-GCM seal/unseal for Buffer OAuth tokens at rest. The encryption key
// is a 32-byte key supplied as exactly 64 hex chars via BUFFER_TOKEN_ENCRYPTION_KEY
// — enforced (not silently derived) so the key IS the raw 256-bit key. It MUST be
// stable across deploys, or stored tokens become undecryptable after a key change.
//
// Ciphertext format: `iv:encryptedData:tag` (hex). The auth tag is verified on
// decrypt, so a tampered or key-mismatched payload throws instead of returning
// garbage. Plaintext tokens never appear in logs.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_HEX_LENGTH = 64;
const PARTS = 3;

function encryptionKey(): Buffer {
  const key = process.env.BUFFER_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("BUFFER_TOKEN_ENCRYPTION_KEY is not set.");
  if (key.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("BUFFER_TOKEN_ENCRYPTION_KEY must be exactly 64 hex chars (a 32-byte key).");
  }
  return Buffer.from(key, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, enc, tag].map((b) => b.toString("hex")).join(":");
}

export function decryptSecret(payload: string): string {
  const parts = String(payload).split(":");
  if (parts.length !== PARTS) throw new Error("Malformed encrypted Buffer token.");
  const [ivHex, dataHex, tagHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}
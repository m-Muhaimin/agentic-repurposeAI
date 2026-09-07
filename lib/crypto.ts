// AES-256-GCM seal/unseal for OAuth tokens at rest. The encryption key is
// derived deterministically from YOUTUBE_TOKEN_ENCRYPTION_KEY so any reasonably
// long passphrase works — but it MUST be stable across deploys, or stored
// refresh tokens become undecryptable after a key change.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const key = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("YOUTUBE_TOKEN_ENCRYPTION_KEY is not set.");
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = String(payload).split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted secret.");
  const decipher = crypto.createDecipheriv(
    ALGO,
    encryptionKey(),
    Buffer.from(parts[0], "base64")
  );
  decipher.setAuthTag(Buffer.from(parts[1], "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[2], "base64")),
    decipher.final()
  ]).toString("utf8");
}
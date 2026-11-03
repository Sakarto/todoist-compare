// Encrypts Todoist tokens before they're stored (AES-256-GCM).
// The key comes from the TOKEN_ENCRYPTION_KEY env var; any long random string works.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc1:";

function key(secret = process.env.TOKEN_ENCRYPTION_KEY): Buffer | null {
  return secret ? createHash("sha256").update(secret).digest() : null;
}

export function hasEncryptionKey(): boolean {
  return key() !== null;
}

export function encrypt(plain: string, secret?: string): string {
  const k = key(secret);
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function decrypt(stored: string, secret?: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext from before encryption existed
  const k = key(secret);
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

// Server-only. App-layer field encryption (SECURITY.md control 1.2) for the
// most sensitive free-text — diagnoses, clinical notes, questionnaire answers.
//
// Even with the database encrypted at rest, this makes a raw DB dump unreadable
// without the app key (which lives in the environment, never in the DB). Uses
// AES-256-GCM: authenticated encryption, so tampering is detected on decrypt.
//
// The key must NOT reach the client — this module reads a server-only env var
// and imports node:crypto, so bundling it into a client component will error.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { serverEnv } from "@/lib/env"

const ALGO = "aes-256-gcm"
const IV_BYTES = 12 // GCM standard nonce length
const VERSION = "v1" // lets us rotate algorithms/keys later without ambiguity

/** True when an app encryption key is configured. */
export function isFieldEncryptionConfigured(): boolean {
  return Boolean(serverEnv.APP_ENCRYPTION_KEY)
}

function getKey(): Buffer {
  const raw = serverEnv.APP_ENCRYPTION_KEY
  if (!raw) {
    // Fail closed: never silently store plaintext where ciphertext is expected.
    throw new Error("APP_ENCRYPTION_KEY is not set — cannot encrypt/decrypt fields.")
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).")
  }
  return key
}

/**
 * Encrypt a string. Output is self-describing and safe to store as text:
 *   v1:<iv>:<authTag>:<ciphertext>   (each part base64)
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

/**
 * Decrypt a value produced by encryptField. Throws if the key is wrong, the
 * payload was tampered with, or the format is unrecognized.
 */
export function decryptField(payload: string): string {
  const parts = payload.split(":")
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognized encrypted field format.")
  }
  const [, ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ])
  return plaintext.toString("utf8")
}

/** Heuristic: does this look like an encryptField() output? (for lazy migration) */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}:`) && value.split(":").length === 4
}

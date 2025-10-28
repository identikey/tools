import { createHash } from "crypto";
import bs58 from "bs58";

/**
 * Computes SHA-256 fingerprint of a public key, encoded as Base58.
 *
 * @param publicKey - The Curve25519 public key (32 bytes)
 * @returns ~44-character Base58 string (SHA-256 hash)
 */
export function computeFingerprint(publicKey: Uint8Array): string {
  const hash = createHash("sha256").update(publicKey).digest();
  return bs58.encode(hash);
}

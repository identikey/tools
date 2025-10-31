import nacl from "tweetnacl";
import bs58 from "bs58";
import { computeFingerprint } from "./header/fingerprint.js";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

// Serialization helpers
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function toBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

// Deserialization helpers
export function fromHex(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "hex"));
}

export function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

export function fromBase58(str: string): Uint8Array {
  return bs58.decode(str);
}

export function generateKeyPair(): KeyPair {
  return nacl.sign.keyPair();
}

/**
 * Key manager for storing and retrieving keypairs by fingerprint.
 *
 * ⚠️ SECURITY WARNING: Private keys are currently stored unencrypted in memory.
 * Memory dumps, debugging tools, or runtime introspection can expose keys.
 * For production use, inject an encrypted key storage implementation or
 * ensure keys are managed through a secure key management system (KMS).
 * This limitation is tracked for post-MVP implementation.
 */
export class KeyManager {
  private keys: Map<string, Uint8Array> = new Map();

  /**
   * Add a keypair indexed by its fingerprint.
   */
  addKey(publicKey: Uint8Array, privateKey: Uint8Array): void {
    const fingerprint = computeFingerprint(publicKey);
    this.keys.set(fingerprint, privateKey);
  }

  /**
   * Retrieve private key by fingerprint.
   * @throws Error if key not found
   */
  getPrivateKey(fingerprint: string): Uint8Array {
    const key = this.keys.get(fingerprint);
    if (!key) {
      throw new Error(`Private key not found for fingerprint: ${fingerprint}`);
    }
    return key;
  }

  /**
   * Check if key exists for fingerprint.
   */
  hasKey(fingerprint: string): boolean {
    return this.keys.has(fingerprint);
  }
}

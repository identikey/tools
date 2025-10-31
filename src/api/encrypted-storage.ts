import { createHash } from "crypto";
import { encrypt } from "../crypto/encryptor.js";
import { decrypt } from "../crypto/decryptor.js";
import { computeFingerprint } from "../header/fingerprint.js";
import { buildHeader } from "../header/serialize.js";
import { parseHeader } from "../header/parse.js";
import { KeyManager } from "../keypair.js";
import type { StorageAdapter } from "../storage/adapter.js";
import type { BlobMetadata } from "../header/schema.js";

/**
 * Main encrypted storage API orchestrating encryption, header management, and storage.
 */
export class EncryptedStorage {
  constructor(
    private storage: StorageAdapter,
    private keyManager: KeyManager
  ) {}

  /**
   * Encrypt and store plaintext.
   * @returns Content hash (SHA-256 of complete blob)
   *
   * @remarks
   * **Known Limitation**: This operation is not idempotent. Network failures
   * between hash computation and storage may leave orphaned data. Transient
   * failures can cause data loss, and concurrent writes may race. Retry logic
   * and idempotency guarantees are deferred to post-MVP implementation.
   */
  async put(
    plaintext: Buffer,
    publicKey: Uint8Array,
    metadata?: Partial<BlobMetadata>
  ): Promise<string> {
    // Encrypt plaintext
    const ciphertext = encrypt(plaintext, publicKey);

    // Build header with metadata
    const fingerprint = computeFingerprint(publicKey);
    const fullMetadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
      ...metadata,
    };
    const header = buildHeader(fullMetadata, fingerprint);

    // Concat header + ciphertext
    const blob = Buffer.concat([header, ciphertext]);

    // Compute content hash
    const contentHash = createHash("sha256").update(blob).digest("hex");

    // Store blob at content hash key
    await this.storage.put(contentHash, blob);

    return contentHash;
  }

  /**
   * Retrieve and decrypt blob by content hash.
   * @param privateKey - Optional explicit key (otherwise lookup via fingerprint)
   * @returns Decrypted plaintext
   */
  async get(contentHash: string, privateKey?: Uint8Array): Promise<Buffer> {
    // Retrieve blob
    const blob = await this.storage.get(contentHash);

    // Verify content hash matches retrieved blob
    const actualHash = createHash("sha256").update(blob).digest("hex");
    if (actualHash !== contentHash) {
      throw new Error(
        `Content hash mismatch: expected ${contentHash}, got ${actualHash}`
      );
    }

    // Parse header
    const { header, ciphertextOffset } = parseHeader(blob);

    // Extract ciphertext
    const ciphertext = blob.subarray(ciphertextOffset);

    // Get private key (explicit or lookup by fingerprint)
    const key =
      privateKey ?? this.keyManager.getPrivateKey(header.keyFingerprint);

    // Decrypt
    const plaintext = decrypt(ciphertext, key);

    // Verify checksum if present
    if (header.metadata.plaintextChecksum) {
      const actualChecksum = createHash("sha256")
        .update(plaintext)
        .digest("hex");
      if (actualChecksum !== header.metadata.plaintextChecksum) {
        throw new Error(
          `Checksum verification failed: expected ${header.metadata.plaintextChecksum}, got ${actualChecksum}`
        );
      }
    }

    return plaintext;
  }

  /**
   * Get metadata without decrypting ciphertext.
   */
  async getMetadata(contentHash: string): Promise<BlobMetadata> {
    const blob = await this.storage.get(contentHash);
    const { header } = parseHeader(blob);
    return header.metadata;
  }

  /**
   * Check if blob exists at content hash.
   */
  async exists(contentHash: string): Promise<boolean> {
    return this.storage.exists(contentHash);
  }

  /**
   * Delete blob by content hash.
   */
  async delete(contentHash: string): Promise<void> {
    return this.storage.delete(contentHash);
  }
}

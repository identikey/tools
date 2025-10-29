import { describe, it, expect } from "bun:test";
import { createHash } from "crypto";
import nacl from "tweetnacl";
import { encrypt } from "../../src/crypto/encryptor.js";
import { buildHeader } from "../../src/header/serialize.js";
import { computeFingerprint } from "../../src/header/fingerprint.js";
import type { BlobMetadata } from "../../src/header/schema.js";

/**
 * Security Test: Correlation Attacks
 *
 * Validates that content-addressable storage prevents correlation attacks
 * by ensuring same plaintext encrypted with different keys produces
 * different content hashes.
 *
 * Acceptance Criteria: AC1
 */
describe("Security: Correlation Attacks", () => {
  it("same plaintext with different keys produces different content hashes", () => {
    // Generate two different Curve25519 keypairs (for encryption)
    const kp1 = nacl.box.keyPair();
    const kp2 = nacl.box.keyPair();

    // Same plaintext for both encryptions
    const plaintext = Buffer.from("sensitive data that must not correlate");

    // Encrypt plaintext with key 1
    const ciphertext1 = encrypt(plaintext, kp1.publicKey);
    const fingerprint1 = computeFingerprint(kp1.publicKey);
    const metadata1: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header1 = buildHeader(metadata1, fingerprint1);
    const blob1 = Buffer.concat([header1, ciphertext1]);
    const contentHash1 = createHash("sha256").update(blob1).digest("hex");

    // Encrypt same plaintext with key 2
    const ciphertext2 = encrypt(plaintext, kp2.publicKey);
    const fingerprint2 = computeFingerprint(kp2.publicKey);
    const metadata2: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header2 = buildHeader(metadata2, fingerprint2);
    const blob2 = Buffer.concat([header2, ciphertext2]);
    const contentHash2 = createHash("sha256").update(blob2).digest("hex");

    // CRITICAL: Content hashes MUST be different
    // This proves no correlation attack is possible via content hash
    expect(contentHash1).not.toBe(contentHash2);

    // Additional validation: headers are different (different fingerprints)
    expect(fingerprint1).not.toBe(fingerprint2);

    // Ciphertexts are different (ephemeral keys + random nonces)
    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it("multiple encryptions of same plaintext with same key produce different hashes", () => {
    // Even with the SAME key, different ephemeral keys and nonces
    // should produce different content hashes
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("test data");

    const fingerprint = computeFingerprint(kp.publicKey);
    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };

    // Encrypt same plaintext twice with same key
    const ciphertext1 = encrypt(plaintext, kp.publicKey);
    const header1 = buildHeader(metadata, fingerprint);
    const blob1 = Buffer.concat([header1, ciphertext1]);
    const hash1 = createHash("sha256").update(blob1).digest("hex");

    const ciphertext2 = encrypt(plaintext, kp.publicKey);
    const header2 = buildHeader(metadata, fingerprint);
    const blob2 = Buffer.concat([header2, ciphertext2]);
    const hash2 = createHash("sha256").update(blob2).digest("hex");

    // Hashes must differ due to random ephemeral keys and nonces
    expect(hash1).not.toBe(hash2);
  });

  it("validates no correlation with realistic file sizes", () => {
    // Test with larger payload (1KB) to simulate realistic usage
    const kp1 = nacl.box.keyPair();
    const kp2 = nacl.box.keyPair();

    // 1KB of identical data
    const plaintext = Buffer.alloc(1024, "A");

    // Encrypt with key 1
    const ciphertext1 = encrypt(plaintext, kp1.publicKey);
    const fingerprint1 = computeFingerprint(kp1.publicKey);
    const metadata1: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header1 = buildHeader(metadata1, fingerprint1);
    const blob1 = Buffer.concat([header1, ciphertext1]);
    const hash1 = createHash("sha256").update(blob1).digest("hex");

    // Encrypt with key 2
    const ciphertext2 = encrypt(plaintext, kp2.publicKey);
    const fingerprint2 = computeFingerprint(kp2.publicKey);
    const metadata2: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header2 = buildHeader(metadata2, fingerprint2);
    const blob2 = Buffer.concat([header2, ciphertext2]);
    const hash2 = createHash("sha256").update(blob2).digest("hex");

    // No correlation even with large identical plaintext
    expect(hash1).not.toBe(hash2);
  });
});

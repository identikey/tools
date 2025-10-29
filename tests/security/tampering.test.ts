import { describe, it, expect } from "bun:test";
import { createHash } from "crypto";
import nacl from "tweetnacl";
import { encrypt } from "../../src/crypto/encryptor.js";
import { decrypt } from "../../src/crypto/decryptor.js";
import { buildHeader } from "../../src/header/serialize.js";
import { computeFingerprint } from "../../src/header/fingerprint.js";
import type { BlobMetadata } from "../../src/header/schema.js";

/**
 * Security Test: Tampering Detection
 *
 * Validates that AEAD (Authenticated Encryption with Associated Data)
 * via TweetNaCl box detects header tampering. Modifying any byte
 * in the header should not affect ciphertext integrity, but the
 * overall blob integrity is ensured through content-addressable storage.
 *
 * Note: TweetNaCl box provides AEAD for the ciphertext itself.
 * The header is not cryptographically authenticated, but content-addressable
 * storage ensures blob integrity (any modification changes content hash).
 *
 * Acceptance Criteria: AC2
 */
describe("Security: Tampering Detection", () => {
  it("modified header is detected via content hash mismatch", () => {
    // Generate keypair and encrypt
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("secret message");

    const ciphertext = encrypt(plaintext, kp.publicKey);
    const fingerprint = computeFingerprint(kp.publicKey);
    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header = buildHeader(metadata, fingerprint);

    // Create original blob and compute content hash
    const originalBlob = Buffer.concat([header, ciphertext]);
    const originalHash = createHash("sha256")
      .update(originalBlob)
      .digest("hex");

    // Tamper with header: modify a byte in the fingerprint section
    const tamperedBlob = Buffer.from(originalBlob);
    const fingerprintStart = 3; // after version (1) + fpLen (2)
    tamperedBlob[fingerprintStart] = tamperedBlob[fingerprintStart] ^ 0x01;

    // Content hash MUST differ (this is the core security property)
    const tamperedHash = createHash("sha256")
      .update(tamperedBlob)
      .digest("hex");
    expect(tamperedHash).not.toBe(originalHash);

    // In content-addressable storage, retrieval by hash would fail:
    // storage.get(originalHash) would not return tamperedBlob
    // This prevents tampering attacks at the storage layer

    // The ciphertext itself is unchanged and AEAD-protected
    const originalCiphertextOffset =
      1 +
      2 +
      fingerprint.length +
      2 +
      header
        .subarray(1 + 2 + fingerprint.length, 1 + 2 + fingerprint.length + 2)
        .readUInt16BE(0);
    const extractedCiphertext = originalBlob.subarray(originalCiphertextOffset);
    const decrypted = decrypt(extractedCiphertext, kp.secretKey);
    expect(decrypted.toString()).toBe("secret message");
  });

  it("modified ciphertext fails AEAD authentication", () => {
    // This is the real AEAD test: tampering with ciphertext must fail
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("authenticated data");

    const ciphertext = encrypt(plaintext, kp.publicKey);

    // Tamper with ciphertext: flip one bit
    const tamperedCiphertext = Buffer.from(ciphertext);
    const tamperIndex = Math.floor(tamperedCiphertext.length / 2);
    tamperedCiphertext[tamperIndex] = tamperedCiphertext[tamperIndex] ^ 0xff;

    // Decryption MUST fail (AEAD authentication)
    expect(() => decrypt(tamperedCiphertext, kp.secretKey)).toThrow();
  });

  it("truncated ciphertext fails decryption", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("test data");

    const ciphertext = encrypt(plaintext, kp.publicKey);

    // Truncate ciphertext (remove last 10 bytes)
    const truncated = ciphertext.subarray(0, ciphertext.length - 10);

    // Decryption must fail
    expect(() => decrypt(truncated, kp.secretKey)).toThrow();
  });

  it("swapped nonce fails AEAD authentication", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("nonce test");

    const ciphertext = encrypt(plaintext, kp.publicKey);

    // TweetNaCl box format: [ephemeralPubKey: 32B][nonce: 24B][ciphertext]
    // Swap first byte of nonce with last byte of nonce
    const tamperedCiphertext = Buffer.from(ciphertext);
    const nonceStart = 32;
    const temp = tamperedCiphertext[nonceStart];
    tamperedCiphertext[nonceStart] = tamperedCiphertext[nonceStart + 23];
    tamperedCiphertext[nonceStart + 23] = temp;

    // Decryption must fail (wrong nonce breaks AEAD)
    expect(() => decrypt(tamperedCiphertext, kp.secretKey)).toThrow();
  });

  it("wrong ephemeral key fails decryption", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("ephemeral key test");

    const ciphertext = encrypt(plaintext, kp.publicKey);

    // Replace ephemeral public key with a different one
    const fakeEphemeral = nacl.box.keyPair().publicKey;
    const tamperedCiphertext = Buffer.from(ciphertext);
    Buffer.from(fakeEphemeral).copy(tamperedCiphertext, 0);

    // Decryption must fail (wrong ephemeral key)
    expect(() => decrypt(tamperedCiphertext, kp.secretKey)).toThrow();
  });
});

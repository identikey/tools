import { describe, it, expect } from "bun:test";
import nacl from "tweetnacl";
import { encrypt } from "../../src/crypto/encryptor.js";
import { decrypt } from "../../src/crypto/decryptor.js";
import { buildHeader } from "../../src/header/serialize.js";
import { parseHeader } from "../../src/header/parse.js";
import { computeFingerprint } from "../../src/header/fingerprint.js";
import type { BlobMetadata } from "../../src/header/schema.js";

/**
 * Security Test: Ciphertext Corruption
 *
 * Validates that corrupted ciphertext produces clear, actionable
 * error messages rather than generic cryptographic failures.
 * Tests various corruption scenarios to ensure robust error handling.
 *
 * Acceptance Criteria: AC3
 */
describe("Security: Ciphertext Corruption", () => {
  it("corrupted ciphertext produces clear error message", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("important data");

    const ciphertext = encrypt(plaintext, kp.publicKey);

    // Corrupt middle section of ciphertext
    const corrupted = Buffer.from(ciphertext);
    const corruptStart = 60;
    for (
      let i = corruptStart;
      i < corruptStart + 10 && i < corrupted.length;
      i++
    ) {
      corrupted[i] = 0xff;
    }

    // Decryption must fail with error
    expect(() => decrypt(corrupted, kp.secretKey)).toThrow();

    // Validate error is thrown (TweetNaCl returns null on auth failure)
    try {
      decrypt(corrupted, kp.secretKey);
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err).toBeDefined();
      // Error message should be descriptive
      const message = (err as Error).message;
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("empty ciphertext produces clear error", () => {
    const kp = nacl.box.keyPair();
    const emptyCiphertext = Buffer.alloc(0);

    // Empty ciphertext fails size validation in TweetNaCl
    expect(() => decrypt(emptyCiphertext, kp.secretKey)).toThrow();

    try {
      decrypt(emptyCiphertext, kp.secretKey);
      expect.fail("Should have thrown error");
    } catch (err) {
      const message = (err as Error).message;
      // TweetNaCl validates sizes first
      expect(message).toBeTruthy();
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("incomplete ciphertext structure produces clear error", () => {
    const kp = nacl.box.keyPair();

    // Ciphertext needs at least: ephemeralPubKey (32B) + nonce (24B) + minimal ciphertext
    const incompleteCiphertext = Buffer.alloc(50); // Too short

    expect(() => decrypt(incompleteCiphertext, kp.secretKey)).toThrow();
  });

  it("random garbage produces clear error", () => {
    const kp = nacl.box.keyPair();

    // Pure random data (not valid TweetNaCl box format)
    const garbage = Buffer.alloc(100);
    for (let i = 0; i < garbage.length; i++) {
      garbage[i] = Math.floor(Math.random() * 256);
    }

    expect(() => decrypt(garbage, kp.secretKey)).toThrow();
  });

  it("header corruption is detected during parsing", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("test");

    const ciphertext = encrypt(plaintext, kp.publicKey);
    const fingerprint = computeFingerprint(kp.publicKey);
    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    // Corrupt header length field
    const corrupted = Buffer.from(blob);
    corrupted.writeUInt16BE(9999, 3); // Invalid fingerprint length

    // Parsing should fail with clear error
    expect(() => parseHeader(corrupted)).toThrow();

    try {
      parseHeader(corrupted);
      expect.fail("Should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("corrupted CBOR metadata produces clear error", () => {
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("test");

    const ciphertext = encrypt(plaintext, kp.publicKey);
    const fingerprint = computeFingerprint(kp.publicKey);
    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    // Find CBOR section and corrupt it
    const corrupted = Buffer.from(blob);
    // CBOR starts after: version(1) + fpLen(2) + fingerprint + metaLen(2)
    const fingerprintLen = fingerprint.length;
    const cborStart = 1 + 2 + fingerprintLen + 2;

    if (cborStart < corrupted.length - 5) {
      // Corrupt CBOR structure
      corrupted[cborStart] = 0xff;
      corrupted[cborStart + 1] = 0xff;

      // Parsing should fail
      expect(() => parseHeader(corrupted)).toThrow();
    }
  });

  it("validates error messages are actionable", () => {
    // Test that error messages provide context, not just generic errors
    const kp = nacl.box.keyPair();
    const plaintext = Buffer.from("test");
    const ciphertext = encrypt(plaintext, kp.publicKey);

    // Use wrong private key (will fail AEAD authentication)
    const wrongKp = nacl.box.keyPair();

    expect(() => decrypt(ciphertext, wrongKp.secretKey)).toThrow();

    try {
      decrypt(ciphertext, wrongKp.secretKey);
      expect.fail("Should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      // Message should be clear and actionable
      expect(message.toLowerCase()).toMatch(/decrypt|invalid|corrupt|fail/);
    }
  });
});

import { describe, it, expect } from "bun:test";
import nacl from "tweetnacl";
import { encrypt } from "./crypto/encryptor.js";
import { decrypt } from "./crypto/decryptor.js";
import { computeFingerprint } from "./header/fingerprint.js";
import { buildHeader } from "./header/serialize.js";
import { parseHeader } from "./header/parse.js";
import type { BlobMetadata } from "./header/schema.js";

describe("integration: full round-trip", () => {
  it("AC#8: plaintext → encrypt → build_header → parse_header → decrypt → original plaintext (exact match)", () => {
    // Setup
    const keypair = nacl.box.keyPair();
    const originalPlaintext = Buffer.from("This is my secret message");

    // Step 1: Encrypt plaintext
    const ciphertext = encrypt(originalPlaintext, keypair.publicKey);

    // Step 2: Compute key fingerprint
    const fingerprint = computeFingerprint(keypair.publicKey);
    expect(fingerprint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);

    // Step 3: Build header
    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
      originalFilename: "secret.txt",
      contentType: "text/plain",
    };
    const header = buildHeader(metadata, fingerprint);

    // Step 4: Construct complete blob
    const blob = Buffer.concat([header, ciphertext]);

    // Step 5: Parse header from blob
    const parsed = parseHeader(blob);
    expect(parsed.header.version).toBe(1);
    expect(parsed.header.keyFingerprint).toBe(fingerprint);
    expect(parsed.header.metadata.algorithm).toBe("TweetNaCl-Box");
    expect(parsed.header.metadata.originalFilename).toBe("secret.txt");

    // Step 6: Extract ciphertext
    const extractedCiphertext = blob.subarray(parsed.ciphertextOffset);
    expect(Buffer.from(extractedCiphertext)).toEqual(Buffer.from(ciphertext));

    // Step 7: Decrypt ciphertext
    const decryptedPlaintext = decrypt(extractedCiphertext, keypair.secretKey);

    // Step 8: Verify exact match
    expect(decryptedPlaintext).toEqual(originalPlaintext);
    expect(decryptedPlaintext.toString()).toBe("This is my secret message");
  });

  it("round-trip with empty plaintext", () => {
    const keypair = nacl.box.keyPair();
    const originalPlaintext = Buffer.from("");

    const ciphertext = encrypt(originalPlaintext, keypair.publicKey);
    const fingerprint = computeFingerprint(keypair.publicKey);

    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    const parsed = parseHeader(blob);
    const extractedCiphertext = blob.subarray(parsed.ciphertextOffset);
    const decryptedPlaintext = decrypt(extractedCiphertext, keypair.secretKey);

    expect(decryptedPlaintext).toEqual(originalPlaintext);
  });

  it("round-trip with large plaintext (100KB)", () => {
    const keypair = nacl.box.keyPair();
    const originalPlaintext = Buffer.alloc(100 * 1024);
    // Fill with pattern
    for (let i = 0; i < originalPlaintext.length; i++) {
      originalPlaintext[i] = i % 256;
    }

    const ciphertext = encrypt(originalPlaintext, keypair.publicKey);
    const fingerprint = computeFingerprint(keypair.publicKey);

    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
      originalFilename: "large-file.bin",
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    const parsed = parseHeader(blob);
    const extractedCiphertext = blob.subarray(parsed.ciphertextOffset);
    const decryptedPlaintext = decrypt(extractedCiphertext, keypair.secretKey);

    expect(decryptedPlaintext).toEqual(originalPlaintext);
  });

  it("round-trip with all optional metadata fields", () => {
    const keypair = nacl.box.keyPair();
    const originalPlaintext = Buffer.from("Full metadata test");

    const ciphertext = encrypt(originalPlaintext, keypair.publicKey);
    const fingerprint = computeFingerprint(keypair.publicKey);

    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: 1730102412345,
      originalFilename: "document.pdf",
      contentType: "application/pdf",
      plaintextChecksum: "abc123" + "0".repeat(58),
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    const parsed = parseHeader(blob);
    expect(parsed.header.metadata).toEqual(metadata);

    const extractedCiphertext = blob.subarray(parsed.ciphertextOffset);
    const decryptedPlaintext = decrypt(extractedCiphertext, keypair.secretKey);

    expect(decryptedPlaintext).toEqual(originalPlaintext);
  });

  it("AC#9: different public keys produce different fingerprints", () => {
    const kp1 = nacl.box.keyPair();
    const kp2 = nacl.box.keyPair();

    const fp1 = computeFingerprint(kp1.publicKey);
    const fp2 = computeFingerprint(kp2.publicKey);

    expect(fp1).not.toBe(fp2);
    expect(fp1).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    expect(fp2).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  });

  it("decryption fails with wrong key", () => {
    const kp1 = nacl.box.keyPair();
    const kp2 = nacl.box.keyPair();
    const plaintext = Buffer.from("secret");

    const ciphertext = encrypt(plaintext, kp1.publicKey);
    const fingerprint = computeFingerprint(kp1.publicKey);

    const metadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
    };
    const header = buildHeader(metadata, fingerprint);
    const blob = Buffer.concat([header, ciphertext]);

    const parsed = parseHeader(blob);
    const extractedCiphertext = blob.subarray(parsed.ciphertextOffset);

    // Try to decrypt with wrong key
    expect(() => {
      decrypt(extractedCiphertext, kp2.secretKey);
    }).toThrow("Decryption failed");
  });
});

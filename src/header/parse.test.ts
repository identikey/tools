import { describe, it, expect } from "bun:test";
import { buildHeader } from "./serialize.js";
import { parseHeader } from "./parse.js";
import type { BlobMetadata } from "./schema.js";

describe("parse", () => {
  describe("parseHeader", () => {
    it("extracts header correctly from valid blob", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1234567890,
      };
      const fingerprint = "9vN8YwkC4DdHbpKqMsT2Rx5L6Pj3VnZuW7GfBc1QmXeE"; // base58

      const header = buildHeader(metadata, fingerprint);
      const blob = Buffer.concat([header, Buffer.from("ciphertext_data")]);

      const result = parseHeader(blob);

      expect(result.header.version).toBe(1);
      expect(result.header.keyFingerprint).toBe(fingerprint);
      expect(result.header.metadata.algorithm).toBe("TweetNaCl-Box");
      expect(result.header.metadata.timestamp).toBe(1234567890);
      expect(result.ciphertextOffset).toBe(header.length);
    });

    it("calculates correct ciphertextOffset", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: "test.txt",
      };
      const fingerprint = "AyTmZx3LqBsWr4Vn8CpK9DfM2HjG5XuN7RwE6QtPcYbS"; // base58

      const header = buildHeader(metadata, fingerprint);
      const ciphertext = Buffer.from("encrypted_content_here");
      const blob = Buffer.concat([header, ciphertext]);

      const result = parseHeader(blob);

      expect(result.ciphertextOffset).toBe(header.length);

      // Verify ciphertext can be extracted at offset
      const extractedCiphertext = blob.subarray(result.ciphertextOffset);
      expect(extractedCiphertext).toEqual(ciphertext);
    });

    it("validates header with Zod before returning", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
      };
      const fingerprint = "BxPmGy4RsCtDu5Zn9HqL2VfN3KjH6XwM8SwF7RuQdYcT"; // base58

      const header = buildHeader(metadata, fingerprint);
      const blob = Buffer.concat([header, Buffer.from("data")]);

      const result = parseHeader(blob);

      // Should have passed Zod validation
      expect(result.header.version).toBe(1);
      expect(result.header.keyFingerprint).toMatch(
        /^[1-9A-HJ-NP-Za-km-z]{43,44}$/
      );
    });

    it("rejects blob with invalid version byte", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
      };
      const fingerprint = "CxQnHz5TsEuFv6Zp1JrM3WgP4LkJ7YxN9TwG8SvReZdU"; // base58

      const header = buildHeader(metadata, fingerprint);

      // Corrupt version byte
      header[0] = 0x02;

      const blob = Buffer.concat([header, Buffer.from("data")]);

      expect(() => {
        parseHeader(blob);
      }).toThrow("Invalid header version");
    });

    it("rejects corrupted CBOR data", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
      };
      const fingerprint = "DxRoJz6UsF1Gw7Zq2KsN4XhQ5MlK8ZyP1UxH9TwSfZeV"; // base58

      const header = buildHeader(metadata, fingerprint);

      // Corrupt CBOR metadata section
      const metadataStart = 1 + 2 + 44 + 2;
      header[metadataStart] = 0xff;
      header[metadataStart + 1] = 0xff;

      const blob = Buffer.concat([header, Buffer.from("data")]);

      expect(() => {
        parseHeader(blob);
      }).toThrow(/CBOR|decode/i);
    });

    it("rejects blob too small to contain header", () => {
      const tinyBlob = Buffer.from([0x01, 0x00]);

      expect(() => {
        parseHeader(tinyBlob);
      }).toThrow("too small");
    });

    it("rejects blob with fingerprint length exceeding blob size", () => {
      const malformedBlob = Buffer.from([
        0x01, // version
        0xff,
        0xff, // fingerprint length = 65535 (way too large)
        0x61,
        0x62, // only 2 bytes follow
      ]);

      expect(() => {
        parseHeader(malformedBlob);
      }).toThrow("exceeds blob size");
    });

    it("rejects blob with invalid fingerprint format (triggers Zod validation)", () => {
      // Build a header with invalid fingerprint (not 64-char hex)
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
      };
      const invalidFingerprint = "ZZZZ"; // not valid hex, not 64 chars

      const header = buildHeader(metadata, invalidFingerprint);
      const blob = Buffer.concat([header, Buffer.from("data")]);

      expect(() => {
        parseHeader(blob);
      }).toThrow(); // Zod will reject
    });

    it("round-trips complex metadata without data loss", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1730102412345,
        originalFilename: "my-document.pdf",
        contentType: "application/pdf",
        plaintextChecksum: "abc123def456" + "0".repeat(52),
      };
      const fingerprint = "ExSpKz7VtG2Hx8Zr3LtP5YiR6NmL9ZzQ2VyJ1UySgZfW"; // base58

      const header = buildHeader(metadata, fingerprint);
      const blob = Buffer.concat([header, Buffer.from("ciphertext")]);

      const result = parseHeader(blob);

      expect(result.header.metadata).toEqual(metadata);
    });
  });
});

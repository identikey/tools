import { describe, it, expect } from "bun:test";
import cbor from "cbor";
const { encode, decode } = cbor;
import { BlobMetadataSchema, BlobHeaderSchema } from "./schema.js";
import type { BlobMetadata, BlobHeader } from "./schema.js";

describe("schema", () => {
  describe("BlobMetadataSchema", () => {
    it("validates valid metadata with all fields", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: "test.txt",
        contentType: "text/plain",
        plaintextChecksum: "a".repeat(64),
      };

      const result = BlobMetadataSchema.parse(metadata);
      expect(result).toEqual(metadata);
    });

    it("validates valid metadata with only required fields", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1234567890,
      };

      const result = BlobMetadataSchema.parse(metadata);
      expect(result).toEqual(metadata);
    });

    it("rejects metadata missing required algorithm", () => {
      const invalid = {
        timestamp: Date.now(),
      };

      expect(() => {
        BlobMetadataSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects metadata missing required timestamp", () => {
      const invalid = {
        algorithm: "TweetNaCl-Box",
      };

      expect(() => {
        BlobMetadataSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects metadata with wrong type for algorithm", () => {
      const invalid = {
        algorithm: 123,
        timestamp: Date.now(),
      };

      expect(() => {
        BlobMetadataSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects metadata with wrong type for timestamp", () => {
      const invalid = {
        algorithm: "TweetNaCl-Box",
        timestamp: "not-a-number",
      };

      expect(() => {
        BlobMetadataSchema.parse(invalid);
      }).toThrow();
    });
  });

  describe("BlobHeaderSchema", () => {
    it("validates valid header", () => {
      const header: BlobHeader = {
        version: 1,
        keyFingerprint: "GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn", // valid base58
        metadata: {
          algorithm: "TweetNaCl-Box",
          timestamp: Date.now(),
        },
      };

      const result = BlobHeaderSchema.parse(header);
      expect(result).toEqual(header);
    });

    it("rejects header with wrong version", () => {
      const invalid = {
        version: 2,
        keyFingerprint: "GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn",
        metadata: {
          algorithm: "TweetNaCl-Box",
          timestamp: Date.now(),
        },
      };

      expect(() => {
        BlobHeaderSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects header with malformed fingerprint (wrong length)", () => {
      const invalid = {
        version: 1,
        keyFingerprint: "abc123",
        metadata: {
          algorithm: "TweetNaCl-Box",
          timestamp: Date.now(),
        },
      };

      expect(() => {
        BlobHeaderSchema.parse(invalid);
      }).toThrow("Base58");
    });

    it("rejects header with malformed fingerprint (invalid base58 chars)", () => {
      const invalid = {
        version: 1,
        keyFingerprint: "0".repeat(44), // '0' not valid in base58
        metadata: {
          algorithm: "TweetNaCl-Box",
          timestamp: Date.now(),
        },
      };

      expect(() => {
        BlobHeaderSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects header with malformed fingerprint (confusable chars)", () => {
      const invalid = {
        version: 1,
        keyFingerprint: "O".repeat(44), // 'O' not valid in base58 (confusable with 0)
        metadata: {
          algorithm: "TweetNaCl-Box",
          timestamp: Date.now(),
        },
      };

      expect(() => {
        BlobHeaderSchema.parse(invalid);
      }).toThrow();
    });

    it("rejects header with invalid metadata", () => {
      const invalid = {
        version: 1,
        keyFingerprint: "GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn",
        metadata: {
          algorithm: "TweetNaCl-Box",
          // missing timestamp
        },
      };

      expect(() => {
        BlobHeaderSchema.parse(invalid);
      }).toThrow();
    });
  });

  describe("CBOR round-trip", () => {
    it("encodes and decodes metadata with all fields without data loss", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1730102400000,
        originalFilename: "document.pdf",
        contentType: "application/pdf",
        plaintextChecksum: "abc123def456" + "0".repeat(52),
      };

      const encoded = encode(metadata);
      const decoded = decode(encoded);
      const validated = BlobMetadataSchema.parse(decoded);

      expect(validated).toEqual(metadata);
    });

    it("encodes and decodes metadata with only required fields", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1234567890,
      };

      const encoded = encode(metadata);
      const decoded = decode(encoded);
      const validated = BlobMetadataSchema.parse(decoded);

      expect(validated).toEqual(metadata);
    });

    it("encodes and decodes metadata with empty optional fields", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: undefined,
        contentType: undefined,
      };

      const encoded = encode(metadata);
      const decoded = decode(encoded);
      const validated = BlobMetadataSchema.parse(decoded);

      // CBOR may omit undefined fields, so only check required fields
      expect(validated.algorithm).toBe(metadata.algorithm);
      expect(validated.timestamp).toBe(metadata.timestamp);
    });

    it("handles large metadata (near 64KB limit)", () => {
      const largeFilename = "x".repeat(60 * 1024); // ~60KB filename
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: largeFilename,
      };

      const encoded = encode(metadata);
      const decoded = decode(encoded);
      const validated = BlobMetadataSchema.parse(decoded);

      expect(validated.originalFilename).toBe(largeFilename);
      expect(encoded.length).toBeLessThan(64 * 1024);
    });

    it("preserves timestamp precision", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1730102412345, // millisecond precision
      };

      const encoded = encode(metadata);
      const decoded = decode(encoded);
      const validated = BlobMetadataSchema.parse(decoded);

      expect(validated.timestamp).toBe(metadata.timestamp);
    });
  });
});

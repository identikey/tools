import { describe, it, expect } from "bun:test";
import { buildHeader } from "./serialize.js";
import type { BlobMetadata } from "./schema.js";

describe("serialize", () => {
  describe("buildHeader", () => {
    it("builds correct wire format with minimal metadata", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1234567890,
      };
      const fingerprint = "GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn"; // base58

      const header = buildHeader(metadata, fingerprint);

      expect(header).toBeInstanceOf(Buffer);

      // Verify structure
      expect(header.readUInt8(0)).toBe(0x01); // version

      const fpLength = header.readUInt16BE(1);
      expect(fpLength).toBe(44); // fingerprint is 44 UTF-8 bytes

      const extractedFp = header.subarray(3, 3 + fpLength).toString("utf-8");
      expect(extractedFp).toBe(fingerprint);
    });

    it("builds correct wire format with all metadata fields", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: "document.pdf",
        contentType: "application/pdf",
        plaintextChecksum: "abc123".repeat(10),
      };
      const fingerprint = "5Q8xMxvEWAFsNVkKxNc7HWvBwBPFdvBG1NWdAr8yuZAP"; // base58

      const header = buildHeader(metadata, fingerprint);

      expect(header).toBeInstanceOf(Buffer);
      expect(header.readUInt8(0)).toBe(0x01);
    });

    it("handles large metadata near 64KB limit", () => {
      const largeFilename = "x".repeat(60 * 1024);
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: largeFilename,
      };
      const fingerprint = "8cPFSvkPy7UYMhMFPqY5VKUi4qS1i6s2uTnqXbfZYJWm"; // base58

      const header = buildHeader(metadata, fingerprint);

      expect(header).toBeInstanceOf(Buffer);
      expect(header.length).toBeLessThan(64 * 1024 + 1000); // header overhead
    });

    it("rejects metadata exceeding 64KB when encoded", () => {
      const hugeFilename = "x".repeat(65 * 1024);
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: Date.now(),
        originalFilename: hugeFilename,
      };
      const fingerprint = "CNKckENt22k1uqKcqQbJH9d3qw8yq3RqVqmKT8Mz3Wbn"; // base58

      expect(() => {
        buildHeader(metadata, fingerprint);
      }).toThrow("exceeds limit");
    });

    it("encodes metadata length correctly", () => {
      const metadata: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1000,
      };
      const fingerprint = "DhxDnSp8CRvLcP1RQqwrQ6sP3BkW7rUu2dxMN4oP8WXy"; // base58

      const header = buildHeader(metadata, fingerprint);

      // Find metadata length field (after version + fp_length + fingerprint)
      const offset = 1 + 2 + 44;
      const metadataLength = header.readUInt16BE(offset);

      expect(metadataLength).toBeGreaterThan(0);
      expect(metadataLength).toBeLessThan(1000); // small metadata
    });

    it("produces different headers for different metadata", () => {
      const metadata1: BlobMetadata = {
        algorithm: "TweetNaCl-Box",
        timestamp: 1000,
      };
      const metadata2: BlobMetadata = {
        algorithm: "TweetNaCl-SecretBox",
        timestamp: 2000,
      };
      const fingerprint = "EzWy5TqA1SNrxP8QpD3MnX7vW2uK9RcT4hLbN6mG8Vjf"; // base58

      const header1 = buildHeader(metadata1, fingerprint);
      const header2 = buildHeader(metadata2, fingerprint);

      expect(header1).not.toEqual(header2);
    });
  });
});

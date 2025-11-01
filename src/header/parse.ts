import cbor from "cbor";
const { decode } = cbor;
import { BlobHeaderSchema } from "./schema.js";
import type { BlobHeader } from "./schema.js";

/**
 * Parses wire-format header from a blob buffer.
 *
 * Extracts:
 * - Version byte
 * - Key fingerprint
 * - CBOR-encoded metadata
 *
 * @param blob - Buffer containing [HEADER][CIPHERTEXT]
 * @returns Object with parsed header and offset to ciphertext start
 * @throws Error if header is malformed or fails Zod validation
 */
export function parseHeader(blob: Buffer): {
  header: BlobHeader;
  ciphertextOffset: number;
} {
  if (blob.length < 5) {
    throw new Error("Blob too small to contain valid header");
  }

  let offset = 0;

  // Read version byte
  const version = blob.readUInt8(offset);
  offset += 1;

  if (version !== 0x01) {
    throw new Error(`Invalid header version: ${version} (expected 1)`);
  }

  // Read fingerprint length
  const fingerprintLength = blob.readUInt16BE(offset);
  offset += 2;

  if (offset + fingerprintLength > blob.length) {
    throw new Error("Fingerprint length exceeds blob size");
  }

  // Read fingerprint
  const fingerprintBytes = blob.subarray(offset, offset + fingerprintLength);
  const keyFingerprint = fingerprintBytes.toString("utf-8");
  offset += fingerprintLength;

  // Read metadata length
  if (offset + 2 > blob.length) {
    throw new Error("Blob too small to contain metadata length");
  }

  const metadataLength = blob.readUInt16BE(offset);
  offset += 2;

  if (offset + metadataLength > blob.length) {
    throw new Error("Metadata length exceeds blob size");
  }

  // Read and decode CBOR metadata
  const metadataBytes = blob.subarray(offset, offset + metadataLength);
  offset += metadataLength;

  let metadata;
  try {
    metadata = decode(metadataBytes);
  } catch (err) {
    throw new Error(
      `Failed to decode CBOR metadata: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Validate with Zod
  const header = BlobHeaderSchema.parse({
    version,
    keyFingerprint,
    metadata,
  });

  return {
    header,
    ciphertextOffset: offset,
  };
}

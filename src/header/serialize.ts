import { encode } from "cbor";
import type { BlobMetadata } from "./schema.js";

const METADATA_SIZE_LIMIT = 64 * 1024; // 64KB

/**
 * Builds wire-format header from metadata and key fingerprint.
 *
 * Wire format:
 * - Byte 0: version (0x01)
 * - Bytes 1-2: fingerprint length (uint16 BE)
 * - Bytes 3-X: fingerprint (UTF-8 bytes)
 * - Bytes X+1,X+2: metadata length (uint16 BE)
 * - Bytes X+3-Y: CBOR-encoded metadata
 *
 * @param metadata - Blob metadata to encode
 * @param fingerprint - 64-character hex SHA-256 key fingerprint
 * @returns Buffer containing wire-format header
 * @throws Error if metadata exceeds 64KB when encoded
 */
export function buildHeader(
  metadata: BlobMetadata,
  fingerprint: string
): Buffer {
  // Encode metadata with CBOR
  const metadataBytes = encode(metadata);

  if (metadataBytes.length > METADATA_SIZE_LIMIT) {
    throw new Error(
      `Metadata size ${metadataBytes.length} exceeds limit of ${METADATA_SIZE_LIMIT} bytes`
    );
  }

  // Convert fingerprint to UTF-8 bytes
  const fingerprintBytes = Buffer.from(fingerprint, "utf-8");

  // Calculate total header size
  const headerSize = 1 + 2 + fingerprintBytes.length + 2 + metadataBytes.length;
  const header = Buffer.allocUnsafe(headerSize);

  let offset = 0;

  // Write version byte
  header.writeUInt8(0x01, offset);
  offset += 1;

  // Write fingerprint length (uint16 BE)
  header.writeUInt16BE(fingerprintBytes.length, offset);
  offset += 2;

  // Write fingerprint bytes
  fingerprintBytes.copy(header, offset);
  offset += fingerprintBytes.length;

  // Write metadata length (uint16 BE)
  header.writeUInt16BE(metadataBytes.length, offset);
  offset += 2;

  // Write CBOR metadata
  Buffer.from(metadataBytes).copy(header, offset);

  return header;
}

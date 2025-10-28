/**
 * Metadata stored in CBOR format within the blob header.
 */
export interface BlobMetadata {
  algorithm: string;
  timestamp: number;
  originalFilename?: string;
  contentType?: string;
  plaintextChecksum?: string;
}

/**
 * Complete blob header structure after validation.
 */
export interface BlobHeader {
  version: 1;
  keyFingerprint: string;
  metadata: BlobMetadata;
}

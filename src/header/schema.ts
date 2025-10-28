import { z } from "zod";

/**
 * Zod schema for blob metadata (CBOR-encoded in header).
 */
export const BlobMetadataSchema = z.object({
  algorithm: z.string(),
  timestamp: z.number(),
  originalFilename: z.string().optional(),
  contentType: z.string().optional(),
  plaintextChecksum: z.string().optional(),
});

/**
 * Zod schema for complete blob header.
 */
export const BlobHeaderSchema = z.object({
  version: z.literal(1),
  keyFingerprint: z
    .string()
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{43,44}$/,
      "Key fingerprint must be Base58-encoded SHA-256 hash (~44 chars)"
    ),
  metadata: BlobMetadataSchema,
});

export type BlobMetadata = z.infer<typeof BlobMetadataSchema>;
export type BlobHeader = z.infer<typeof BlobHeaderSchema>;

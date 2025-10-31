// Re-export keypair functionality
export {
  type KeyPair,
  generateKeyPair,
  toHex,
  toBase64,
  toBase58,
  fromHex,
  fromBase64,
  fromBase58,
  KeyManager,
} from "./keypair.js";

// Crypto primitives
export { encrypt } from "./crypto/encryptor.js";
export { decrypt } from "./crypto/decryptor.js";

// Header management
export { computeFingerprint } from "./header/fingerprint.js";
export { buildHeader } from "./header/serialize.js";
export { parseHeader } from "./header/parse.js";
export {
  BlobMetadataSchema,
  BlobHeaderSchema,
  type BlobMetadata,
  type BlobHeader,
} from "./header/schema.js";

// Storage
export { type StorageAdapter } from "./storage/adapter.js";
export { MinioAdapter } from "./storage/minio-adapter.js";
export { MemoryAdapter } from "./storage/memory-adapter.js";
export {
  FilesystemAdapter,
  type FilesystemConfig,
} from "./storage/filesystem-adapter.js";
export {
  type MinioConfig,
  type StorageConfig,
} from "./types/storage-config.js";

// Main API
export { EncryptedStorage } from "./api/encrypted-storage.js";

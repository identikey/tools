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

// Persona management (identity information blobs attached to base private key)
export function createPersona() {}
export function queryPersona() {}

// Identity management
export function createIdentity() {}
export function queryIdentity() {}

// Content-based addressing
export function getContentAddress() {}

// Storage encryption/decryption
export function encryptStorage() {}
export function decryptStorage() {}

// S3-compatible API - proxyable to other backend storage
export function uploadToStorage() {}
export function downloadFromStorage() {}
export function listStorage() {}
export function deleteFromStorage() {}
export function getStorageMetadata() {}

# IdentiKey Tools

> **Content-addressable encrypted storage for digital sovereignty**

IdentiKey Tools provides secure, content-addressable encrypted storage using Ed25519 for verifiable signatures, and Curve25519 for strong private-key encryption, and SHA-256 content-based addressing. Store sensitive data with end-to-end encryption, retrieve by content hash, and maintain complete ownership of your identity and keys.

[![CI](https://github.com/identikey/tools/workflows/CI/badge.svg)](https://github.com/identikey/tools/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- 🔐 **End-to-end encryption** - Curve25519 + XSalsa20-Poly1305
- 📦 **Content-addressable** - SHA-256 hashing prevents corruption and enables deduplication
- 🎯 **Zero-knowledge storage** - Backend never sees plaintext
- 🔑 **Flexible key management** - Store keys locally, use hardware security modules, or integrate with key vaults
- ☁️ **S3-compatible** - Works with MinIO, AWS S3, and any S3-compatible storage
- 🚀 **High performance** - 1894 MB/s hash throughput, sub-second encryption for typical files
- ✅ **Production-ready** - Comprehensive test coverage (90+ tests), CI/CD pipeline, security validated

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Examples](#examples)
- [Deployment](#deployment)
- [Development](#development)
- [Security](#security)
- [License](#license)

## Installation

### Requirements

- **Runtime:** Bun >= 1.0 or Node.js >= 18
- **Storage:** MinIO (local) or AWS S3 (production)

### Install Package

```bash
# Using Bun (recommended)
bun add @identikey/tools

# Using npm
npm install @identikey/tools

# Using yarn
yarn add @identikey/tools
```

### Local MinIO Setup

For e2e tests and developing on the S3-compatible storage adapter, run MinIO locally:

```bash
# Using Docker
docker run -d \
  --name identikey-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"

# Access MinIO Console at http://localhost:9001
```

Or use docker-compose:

```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
```

## Quick Start

### 1. Generate Keypair

```typescript
import nacl from "tweetnacl";

// Generate Curve25519 keypair for encryption
const keypair = nacl.box.keyPair();

console.log("Public key:", Buffer.from(keypair.publicKey).toString("hex"));
console.log(
  "Private key (keep secret!):",
  Buffer.from(keypair.secretKey).toString("hex")
);
```

### 2. Configure Storage

```typescript
import { EncryptedStorage, KeyManager } from "@identikey/tools";
import { MinioAdapter } from "@identikey/tools/storage/minio-adapter";

// Setup storage backend
const adapter = new MinioAdapter({
  endpoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  bucket: "identikey-storage",
});

// Create storage with key management
const keyManager = new KeyManager();
keyManager.addKey(keypair.publicKey, keypair.secretKey);

const storage = new EncryptedStorage(adapter, keyManager);

// Ensure bucket exists
await adapter.ensureBucket();
```

### 3. Encrypt & Store

```typescript
const plaintext = Buffer.from("Hello, digital sovereignty!");

// Encrypt and store - returns content hash
const contentHash = await storage.put(plaintext, keypair.publicKey, {
  originalFilename: "message.txt",
  contentType: "text/plain",
});

console.log("Stored at content hash:", contentHash);
// Output: "3f7a8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
```

### 4. Retrieve & Decrypt

```typescript
// Retrieve by content hash
const decrypted = await storage.get(contentHash);

console.log("Decrypted:", decrypted.toString());
// Output: "Hello, digital sovereignty!"
```

### Complete Example

```typescript
import nacl from "tweetnacl";
import { EncryptedStorage, KeyManager } from "@identikey/tools";
import { MinioAdapter } from "@identikey/tools/storage/minio-adapter";

async function main() {
  // 1. Generate keypair
  const keypair = nacl.box.keyPair();

  // 2. Setup storage
  const adapter = new MinioAdapter({
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: "identikey-storage",
  });

  const keyManager = new KeyManager();
  keyManager.addKey(keypair.publicKey, keypair.secretKey);

  const storage = new EncryptedStorage(adapter, keyManager);
  await adapter.ensureBucket();

  // 3. Encrypt and store
  const plaintext = Buffer.from("Secret data");
  const contentHash = await storage.put(plaintext, keypair.publicKey);
  console.log("✓ Encrypted and stored:", contentHash);

  // 4. Retrieve and decrypt
  const decrypted = await storage.get(contentHash);
  console.log("✓ Retrieved and decrypted:", decrypted.toString());

  // 5. Cleanup
  await storage.delete(contentHash);
  console.log("✓ Cleaned up");
}

main().catch(console.error);
```

## API Reference

### EncryptedStorage

Main API for encrypted content-addressable storage.

#### `constructor(storage: StorageAdapter, keyManager: KeyManager)`

Creates a new encrypted storage instance.

**Parameters:**

- `storage` - Storage backend adapter (MinioAdapter, S3Adapter, etc.)
- `keyManager` - Key manager for recipient key lookup

#### `async put(plaintext: Buffer, publicKey: Uint8Array, metadata?: Partial<BlobMetadata>): Promise<string>`

Encrypts plaintext and stores in backend.

**Parameters:**

- `plaintext` - Data to encrypt
- `publicKey` - Recipient's Curve25519 public key (32 bytes)
- `metadata` - Optional metadata (filename, content type, checksum, etc.)

**Returns:** Content hash (SHA-256 hex, 64 characters)

**Example:**

```typescript
const hash = await storage.put(Buffer.from("data"), publicKey, {
  originalFilename: "doc.txt",
  contentType: "text/plain",
});
```

#### `async get(contentHash: string, privateKey?: Uint8Array): Promise<Buffer>`

Retrieves and decrypts blob by content hash.

**Parameters:**

- `contentHash` - SHA-256 content hash (from `put()`)
- `privateKey` - Optional explicit private key (otherwise uses KeyManager)

**Returns:** Decrypted plaintext

**Throws:** Error if blob not found, wrong key, or corrupted data

#### `async getMetadata(contentHash: string): Promise<BlobMetadata>`

Retrieves metadata without decrypting ciphertext.

#### `async exists(contentHash: string): Promise<boolean>`

Checks if blob exists at content hash.

#### `async delete(contentHash: string): Promise<void>`

Deletes blob from storage.

### KeyManager

Manages recipient keypairs for decryption.

#### `addKey(publicKey: Uint8Array, privateKey: Uint8Array): void`

Adds a keypair indexed by public key fingerprint.

#### `getPrivateKey(fingerprint: string): Uint8Array`

Retrieves private key by fingerprint. Throws if not found.

#### `hasKey(fingerprint: string): boolean`

Checks if key exists for fingerprint.

### Storage Adapters

IdentiKey Tools supports multiple storage backends via the `StorageAdapter` interface.

#### MinioAdapter (Production)

S3-compatible object storage for production use.

**Config:**

```typescript
interface MinioConfig {
  endpoint: string; // MinIO hostname (e.g., 'localhost', 's3.amazonaws.com')
  port: number; // API port (9000 for MinIO, 443 for S3)
  useSSL: boolean; // Use HTTPS (always true in production)
  accessKey: string; // Access key / AWS_ACCESS_KEY_ID
  secretKey: string; // Secret key / AWS_SECRET_ACCESS_KEY
  bucket: string; // Bucket name
}
```

**Methods:**

- `async ensureBucket(): Promise<void>` - Creates bucket if not exists

#### MemoryAdapter (Testing)

In-memory storage for fast unit tests. No configuration required.

**Methods:**

- `clear(): void` - Clears all stored blobs
- `size(): number` - Returns number of stored blobs

#### FilesystemAdapter (Local Development)

Local file storage with atomic writes and path security.

**Config:**

```typescript
interface FilesystemConfig {
  rootDir: string; // Root directory for blob storage
}
```

**Methods:**

- `async ensureRoot(): Promise<void>` - Creates root directory
- `async clear(): Promise<void>` - Deletes all blobs

See [`tests/e2e/minio-integration.test.ts`](tests/e2e/minio-integration.test.ts) for detailed adapter usage examples.

### BlobMetadata

```typescript
interface BlobMetadata {
  algorithm: string; // Encryption algorithm (e.g., "TweetNaCl-Box")
  timestamp: number; // Unix timestamp (milliseconds)
  originalFilename?: string; // Original filename
  contentType?: string; // MIME type
  plaintextChecksum?: string; // SHA-256 of plaintext (for integrity)
  customMetadata?: Record<string, any>; // Arbitrary metadata
}
```

## Architecture

IdentiKey Tools uses a layered architecture:

```
┌─────────────────────────────────────────┐
│         EncryptedStorage API            │  ← User-facing API
├─────────────────────────────────────────┤
│  Encryption │ Header │ Key Management   │  ← Crypto layer
│  (TweetNaCl)│ (CBOR) │ (KeyManager)     │
├─────────────────────────────────────────┤
│      Storage Adapter Interface          │  ← Abstraction layer
├─────────────────────────────────────────┤
│  MinIO │ AWS S3 │ Filesystem │ Custom   │  ← Backend implementations
└─────────────────────────────────────────┘
```

**Key Design Principles:**

1. **Content-addressable** - SHA-256 hashing enables deduplication and integrity verification
2. **Zero-knowledge storage** - Backend only sees encrypted blobs, never plaintexts
3. **Pluggable backends** - Storage adapter interface supports any S3-compatible backend
4. **Cryptographic agility** - Header format supports multiple encryption algorithms (currently TweetNaCl)

**Detailed Architecture:** See [`docs/architecture/content-addressable-encrypted-storage.md`](docs/architecture/content-addressable-encrypted-storage.md)

## Examples

### Basic Usage

See [`examples/basic-usage.ts`](examples/basic-usage.ts) for complete workflow demonstration.

### Key Management

See [`examples/key-management.ts`](examples/key-management.ts) for KeyManager usage patterns.

### Multi-Recipient (Future)

See [`examples/multiple-recipients.ts`](examples/multiple-recipients.ts) for future multi-recipient pattern.

## Deployment

### Environment Variables

```bash
# Required
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=identikey-storage

# Optional
MINIO_USE_SSL=false  # Set to 'true' in production
LOG_LEVEL=info
```

### Production Deployment

See [`docs/deployment-guide.md`](docs/deployment-guide.md) for comprehensive deployment instructions:

- Docker and Kubernetes deployment
- AWS S3 configuration
- Environment validation
- Monitoring and logging
- Security hardening

### Performance

- **Hash throughput:** 1,894 MB/s (SHA-256)
- **Encryption:** ~20ms per MB (TweetNaCl)
- **Decryption:** ~20ms per MB (TweetNaCl)
- **E2E latency (1MB):** ~70-120ms encrypt+upload, ~70-120ms download+decrypt (local MinIO)

See [`docs/architecture/performance-baseline-2025-10-29.md`](docs/architecture/performance-baseline-2025-10-29.md) for detailed benchmarks.

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/identikey/tools.git
cd tools

# Install dependencies
bun install

# Start local MinIO
docker-compose up -d
```

### Scripts

```bash
# Run tests (unit tests, no network dependency)
bun test

# Run E2E tests (requires MinIO)
bun run test:e2e

# Run all tests
bun run test:all

# Run with coverage
bun run test:coverage

# Run security tests only
bun run test:security

# Run benchmarks only
bun run test:benchmarks

# Lint
bun run lint

# Build
bun run build
```

### Test Coverage

Current coverage: **99+ tests**, covering:

- Unit tests (crypto primitives, header encoding, key management) - `MemoryAdapter`
- Integration tests (full encryption workflow) - `MemoryAdapter`
- Security tests (correlation, tampering, corruption) - `MemoryAdapter`
- Performance benchmarks (encryption, hashing, retrieval) - `MemoryAdapter`
- E2E tests (MinIO integration, optional) - `MinioAdapter`

**All unit tests run offline** with no network dependency. E2E tests skip gracefully if MinIO not available.

Test suite includes:
- Unit tests: `src/**/*.test.ts`
- Security validation: `tests/security/`
- Performance benchmarks: `tests/benchmarks/`
- E2E integration: `tests/e2e/`

## Security

### Cryptography

- **Encryption:** TweetNaCl box (Curve25519 ECDH + XSalsa20 stream cipher + Poly1305 MAC)
- **Hashing:** SHA-256 (FIPS 180-4)
- **Key fingerprinting:** SHA-256 + Base58 encoding

### Security Model

- **Threat model:** Assumes trusted client, untrusted storage backend
- **AEAD protection:** Authenticated encryption prevents tampering
- **Content addressing:** Hash-based retrieval prevents substitution attacks
- **No correlation:** Random ephemeral keys ensure same plaintext produces different hashes

### Security Validations

See [`docs/architecture/security-validation-2025-10-29.md`](docs/architecture/security-validation-2025-10-29.md) for comprehensive security test results.

**Key validations:**

- ✅ No plaintext correlation via content hashing
- ✅ AEAD authentication detects tampering
- ✅ Clear error messages for corrupted data
- ✅ Failed decryption attempts logged for audit

### Reporting Vulnerabilities

Please report security vulnerabilities to: **security@identikey.io**

Do not open public GitHub issues for security vulnerabilities.

## Roadmap

- [ ] Multi-recipient encryption (group sharing)
- [ ] Key rotation mechanisms
- [ ] Hardware security module (HSM) integration
- [ ] Compression layer (ZSTD)
- [ ] Native crypto bindings (OpenSSL) for performance
- [ ] Filesystem adapter (local development)
- [ ] WebAssembly build (browser usage)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`bun test`)
5. Submit a pull request

## License

MIT © 2025 Duke Jones

See [LICENSE](LICENSE) for details.

## Acknowledgments

- **TweetNaCl:** Audited cryptography library by Daniel J. Bernstein et al.
- **MinIO:** High-performance object storage
- **Bun:** Fast JavaScript runtime and toolkit

---

**Built with ❤️ for digital sovereignty**  
**IdentiKey Tools** - Your identity, your keys, your data.

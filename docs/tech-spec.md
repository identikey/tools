# IdentiKey Tools - Technical Specification

**Author:** Master d0rje
**Date:** 2025-10-28
**Project Level:** 1
**Project Type:** product
**Development Context:** greenfield

---

## Source Tree Structure

```
src/
  crypto/
    encryptor.ts           # TweetNaCl box/secretbox wrapper for encryption
    decryptor.ts           # Decryption + header parsing
    keypair.ts             # Key generation and management (already exists)
  header/
    schema.ts              # Zod schema for header validation
    serialize.ts           # buildHeader(metadata) → Buffer
    parse.ts               # parseHeader(buf) → { header, ciphertextOffset }
    fingerprint.ts         # sha256(publicKey) → hex string
  storage/
    adapter.ts             # Abstract interface: put/get/exists/delete
    minio-adapter.ts       # MinIO implementation
  api/
    encrypted-storage.ts   # Main EncryptedStorage API
  types/
    blob-metadata.ts       # BlobMetadata interface
    storage-config.ts      # StorageConfig interface
tests/
  unit/
    header/                # Header serialization tests
    crypto/                # Encryption/decryption tests
    fingerprint.test.ts    # Key fingerprint tests
  integration/
    e2e-flow.test.ts       # Full encrypt→store→retrieve→decrypt
    minio.test.ts          # Backend integration tests
```

---

## Technical Approach

### Core Design Pattern: Content-Addressable Encrypted Storage

Files are encrypted with keypairs, stored by their content hash (SHA-256), and include embedded metadata (CBOR-encoded) for key identification during decryption.

**Key Design Decisions:**

1. **Hash ciphertext, not plaintext** - Prevents correlation attacks where attacker could identify files by comparing plaintext hashes. Trade-off: lose deduplication across different keys.

2. **Embedded metadata via CBOR** - Self-contained blobs with key fingerprint and metadata encoded directly in header. More portable, atomic, and 20-40% smaller than JSON.

3. **Hybrid encryption pattern** - TweetNaCl primitives for authenticated encryption (XSalsa20-Poly1305) with Curve25519 key exchange.

4. **Backend-agnostic architecture** - Abstract storage interface with pluggable adapters (default: MinIO).

### Blob Structure

```
[HEADER] + [CIPHERTEXT]

HEADER:
  - Version (1 byte): 0x01
  - Key Fingerprint Length (2 bytes)
  - Key Fingerprint (variable, SHA-256 hex of public key)
  - Metadata Length (2 bytes)
  - Metadata (variable, CBOR-encoded)

CIPHERTEXT:
  - Encrypted content (variable)
```

Content hash = SHA-256(complete blob including header)

---

## Implementation Stack

### Core Dependencies

| Library            | Version | Purpose                                        |
| ------------------ | ------- | ---------------------------------------------- |
| **tweetnacl**      | ^1.0.3  | Crypto primitives (box, secretbox, Curve25519) |
| **tweetnacl-util** | ^0.15.1 | Encoding utilities for TweetNaCl               |
| **zod**            | ^3.22.4 | Runtime schema validation                      |
| **cbor**           | ^9.0.1  | CBOR encoding/decoding (RFC 8949)              |
| **minio**          | ^7.1.3  | MinIO client for object storage                |

### Development Dependencies

| Tool           | Version   | Purpose                                    |
| -------------- | --------- | ------------------------------------------ |
| **TypeScript** | ^5.3.3    | Type safety                                |
| **Bun**        | ^1.0.0    | Runtime + test runner (already in project) |
| **tsdown**     | (current) | Build tooling (already in project)         |

### Runtime Environment

- **Node.js**: >= 18.0.0 (for native crypto + async/await)
- **Storage Backend**: MinIO latest (default), S3-compatible

---

## Technical Details

### Encryption Flow

1. **Keypair Setup**

   - Generate Curve25519 keypair via `tweetnacl.box.keyPair()`
   - Compute fingerprint: `SHA-256(publicKey).toString('hex')`

2. **Encryption Process**

   ```typescript
   plaintext → encrypt(publicKey) → ciphertext
   metadata → CBOR.encode() → metadataBytes
   header = [version | fpLength | fingerprint | mdLength | metadataBytes]
   blob = header + ciphertext
   contentHash = SHA-256(blob).hex
   ```

3. **Storage**
   - PUT blob to backend at key = contentHash
   - Return contentHash to caller

### Decryption Flow

1. **Retrieval**

   - GET blob from backend using contentHash

2. **Header Parsing**

   ```typescript
   buffer → readVersion(1 byte)
   → readFingerprintLength(2 bytes)
   → readFingerprint(fpLength bytes)
   → readMetadataLength(2 bytes)
   → readMetadata(mdLength bytes)
   → CBOR.decode(metadata)
   ```

3. **Decryption**
   - Lookup privateKey by fingerprint from keystore
   - Decrypt ciphertext using `tweetnacl.box.open()`
   - Verify content hash matches
   - Optionally verify plaintextChecksum from metadata

### Key Fingerprinting

```typescript
// fingerprint.ts
import { createHash } from "crypto";

export function computeFingerprint(publicKey: Uint8Array): string {
  return createHash("sha256").update(publicKey).digest("hex");
}
```

### CBOR Metadata Schema (Zod)

```typescript
// schema.ts
import { z } from "zod";

export const BlobMetadataSchema = z.object({
  algorithm: z.string(), // e.g., "TweetNaCl-Box"
  timestamp: z.number(), // Unix timestamp
  originalFilename: z.string().optional(),
  contentType: z.string().optional(),
  plaintextChecksum: z.string().optional(), // SHA-256 hex
});

export const BlobHeaderSchema = z.object({
  version: z.literal(1),
  keyFingerprint: z.string().regex(/^[a-f0-9]{64}$/), // SHA-256 hex
  metadata: BlobMetadataSchema,
});
```

### Storage Adapter Interface

```typescript
// adapter.ts
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
```

---

## Development Setup

### Prerequisites

```bash
# Already installed in project:
- Bun v1.x
- TypeScript
- tsdown for builds
```

### Install New Dependencies

```bash
bun add tweetnacl tweetnacl-util zod cbor minio
bun add -d @types/node
```

### MinIO Local Setup

```bash
# Using Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create test bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/encrypted-blobs
```

### Environment Variables

```bash
# .env.local
STORAGE_BACKEND=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=encrypted-blobs
MINIO_USE_SSL=false
```

---

## Implementation Guide

### Phase 1: Core Crypto (Week 1)

**Files to create:**

1. `src/crypto/encryptor.ts` - Wrap TweetNaCl box for encryption
2. `src/crypto/decryptor.ts` - Wrap TweetNaCl box.open for decryption
3. `src/header/fingerprint.ts` - SHA-256 fingerprint computation
4. Update `src/keypair.ts` - Ensure compatibility with TweetNaCl format

**Key functions:**

- `encrypt(plaintext: Buffer, publicKey: Uint8Array): Promise<Buffer>`
- `decrypt(ciphertext: Buffer, privateKey: Uint8Array): Promise<Buffer>`
- `computeFingerprint(publicKey: Uint8Array): string`

**Tests:**

- Round-trip: encrypt → decrypt = original
- Different keys produce different ciphertexts
- Fingerprint uniqueness and determinism

### Phase 2: Header Management (Week 1-2)

**Files to create:**

1. `src/header/schema.ts` - Zod schemas
2. `src/header/serialize.ts` - Build header buffer
3. `src/header/parse.ts` - Parse header from buffer
4. `src/types/blob-metadata.ts` - TypeScript interfaces

**Key functions:**

- `buildHeader(metadata: BlobMetadata, fingerprint: string): Buffer`
- `parseHeader(blob: Buffer): { header: BlobHeader, ciphertextOffset: number }`
- `validateHeader(header: unknown): BlobHeader` (Zod validation)

**Wire format:**

```
Bytes 0-0:     version (0x01)
Bytes 1-2:     fingerprint length (uint16 BE)
Bytes 3-X:     fingerprint (hex string as UTF-8)
Bytes X+1,X+2: metadata length (uint16 BE)
Bytes X+3-Y:   CBOR metadata
Bytes Y+1-end: ciphertext
```

**Tests:**

- Serialize → parse round-trip
- CBOR encoding correctness
- Invalid header rejection (Zod)
- Large metadata handling

### Phase 3: Storage Backend (Week 2)

**Files to create:**

1. `src/storage/adapter.ts` - Interface definition
2. `src/storage/minio-adapter.ts` - MinIO implementation
3. `src/types/storage-config.ts` - Config types

**MinIO adapter implementation:**

```typescript
import * as Minio from "minio";

export class MinioAdapter implements StorageAdapter {
  private client: Minio.Client;
  private bucket: string;

  constructor(config: MinioConfig) {
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.putObject(this.bucket, key, data);
  }

  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return streamToBuffer(stream);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
```

**Tests:**

- CRUD operations against local MinIO
- Error handling (not found, network failure)
- Large blob handling (>10MB)

### Phase 4: Main API (Week 3)

**Files to create:**

1. `src/api/encrypted-storage.ts` - EncryptedStorage class

**Implementation:**

```typescript
export class EncryptedStorage {
  constructor(
    private storage: StorageAdapter,
    private keyManager: KeyManager
  ) {}

  async put(
    plaintext: Buffer,
    publicKey: Uint8Array,
    metadata?: Partial<BlobMetadata>
  ): Promise<string> {
    // 1. Compute fingerprint
    const fingerprint = computeFingerprint(publicKey);

    // 2. Build metadata
    const fullMetadata: BlobMetadata = {
      algorithm: "TweetNaCl-Box",
      timestamp: Date.now(),
      plaintextChecksum: sha256(plaintext),
      ...metadata,
    };

    // 3. Encrypt
    const ciphertext = await encrypt(plaintext, publicKey);

    // 4. Build header
    const header = buildHeader(fullMetadata, fingerprint);

    // 5. Combine
    const blob = Buffer.concat([header, ciphertext]);

    // 6. Hash
    const contentHash = sha256(blob);

    // 7. Store
    await this.storage.put(contentHash, blob);

    return contentHash;
  }

  async get(contentHash: string, privateKey?: Uint8Array): Promise<Buffer> {
    // 1. Retrieve blob
    const blob = await this.storage.get(contentHash);

    // 2. Parse header
    const { header, ciphertextOffset } = parseHeader(blob);

    // 3. Lookup key if not provided
    const key =
      privateKey ||
      (await this.keyManager.getPrivateKey(header.keyFingerprint));

    // 4. Extract ciphertext
    const ciphertext = blob.subarray(ciphertextOffset);

    // 5. Decrypt
    const plaintext = await decrypt(ciphertext, key);

    // 6. Verify checksum if present
    if (header.metadata.plaintextChecksum) {
      const actual = sha256(plaintext);
      if (actual !== header.metadata.plaintextChecksum) {
        throw new Error("Checksum mismatch");
      }
    }

    return plaintext;
  }

  async getMetadata(contentHash: string): Promise<BlobMetadata> {
    const blob = await this.storage.get(contentHash);
    const { header } = parseHeader(blob);
    return header.metadata;
  }

  async exists(contentHash: string): Promise<boolean> {
    return this.storage.exists(contentHash);
  }

  async delete(contentHash: string): Promise<void> {
    return this.storage.delete(contentHash);
  }
}
```

**Tests:**

- E2E: put → get → verify
- Metadata retrieval without decryption
- Key fingerprint lookup
- Checksum verification

### Phase 5: Key Management (Week 3-4)

**File to enhance:**

- `src/keypair.ts` (already exists)

**Add KeyManager class:**

```typescript
export class KeyManager {
  private keys: Map<string, Uint8Array> = new Map();

  addKey(publicKey: Uint8Array, privateKey: Uint8Array): void {
    const fingerprint = computeFingerprint(publicKey);
    this.keys.set(fingerprint, privateKey);
  }

  async getPrivateKey(fingerprint: string): Promise<Uint8Array> {
    const key = this.keys.get(fingerprint);
    if (!key) throw new Error(`Key not found: ${fingerprint}`);
    return key;
  }

  hasKey(fingerprint: string): boolean {
    return this.keys.has(fingerprint);
  }
}
```

**Security consideration:** In production, private keys should be encrypted at rest.

---

## Testing Approach

### Unit Tests (Bun test runner)

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

**Test files:**

- `tests/unit/header/serialize.test.ts` - Header building
- `tests/unit/header/parse.test.ts` - Header parsing
- `tests/unit/header/fingerprint.test.ts` - Key fingerprinting
- `tests/unit/crypto/encrypt.test.ts` - Encryption correctness
- `tests/unit/crypto/decrypt.test.ts` - Decryption correctness

**Key test cases:**

1. CBOR round-trip (metadata → bytes → metadata)
2. Fingerprint determinism (same key → same fingerprint)
3. Encryption uniqueness (same plaintext, same key → different ciphertext due to nonce)
4. Header size calculations
5. Invalid header rejection

### Integration Tests

```bash
# Requires MinIO running
docker-compose up -d minio
bun test:integration
```

**Test files:**

- `tests/integration/e2e-flow.test.ts` - Full cycle
- `tests/integration/minio.test.ts` - Backend operations
- `tests/integration/large-files.test.ts` - >100MB files

**Key scenarios:**

1. Encrypt 1KB, 1MB, 100MB files
2. Concurrent uploads/downloads
3. Missing key handling
4. Corrupted blob detection
5. Backend failure recovery

### Security Tests

```typescript
// tests/security/correlation.test.ts
test("Same plaintext with different keys produces different hashes", () => {
  const plaintext = Buffer.from("secret data");
  const key1 = generateKeyPair();
  const key2 = generateKeyPair();

  const hash1 = await putAndGetHash(plaintext, key1.publicKey);
  const hash2 = await putAndGetHash(plaintext, key2.publicKey);

  expect(hash1).not.toBe(hash2);
});
```

### Performance Benchmarks

Target metrics (local MinIO):

- 1MB encrypt + upload: < 500ms
- 1MB download + decrypt: < 300ms
- Hash computation: > 100 MB/s
- Overhead: header < 1KB for typical metadata

---

## Deployment Strategy

### Development Environment

```bash
# Local setup
docker-compose up -d  # Start MinIO
bun install
bun run build
bun test
```

### Production Considerations

**Storage Backend Options:**

1. **MinIO** (self-hosted)

   - Deploy via Kubernetes or Docker Swarm
   - Configure persistent volumes
   - Set up access policies

2. **AWS S3** (managed)

   - Use S3-compatible adapter
   - Configure IAM roles
   - Enable versioning for blob recovery

3. **Filesystem** (simple/testing)
   - Not recommended for production
   - Use only for local dev or CI

**Security Hardening:**

1. Private keys encrypted at rest (not in MVP)
2. Backend credentials via secrets manager (AWS Secrets Manager, Vault)
3. TLS for all backend communication
4. Regular key rotation policy
5. Audit logging for all operations

**Monitoring:**

- Storage backend health checks
- Encryption/decryption latency metrics
- Failed decryption alerts (potential attack)
- Storage capacity monitoring

**CI/CD Pipeline:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      minio:
        image: minio/minio
        ports:
          - 9000:9000
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run build
```

### Rollout Plan

**Week 1-2:** Core crypto + header management
**Week 3:** Storage backend + API
**Week 4:** Integration tests + documentation
**Week 5:** Security review + performance testing
**Week 6:** Production deployment (if applicable)

### Rollback Strategy

Since this is greenfield with no existing data:

- Tag releases with semantic versioning
- Keep backward compatibility for blob format (version byte = 0x01)
- If blob format changes, bump version byte and support multiple versions in parser

---

## Future Enhancements (Post-MVP)

1. **Multi-recipient encryption** - Symmetric content key wrapped per recipient
2. **Streaming API** - For files > 10MB
3. **Compression** - Before encryption (e.g., zstd)
4. **Key rotation** - Re-encrypt with new keypair
5. **Metadata indexing** - Searchable metadata store
6. **Filesystem backend** - For testing/simple deployments
7. **S3 adapter** - AWS S3 support
8. **Access audit logs** - Who accessed what, when
9. **TTL/expiration** - Automatic blob cleanup
10. **Chunk-based storage** - For deduplication at chunk level

---

## Risk Assessment

| Risk                   | Impact                    | Mitigation                                    |
| ---------------------- | ------------------------- | --------------------------------------------- |
| Key loss               | High - data unrecoverable | Key backup procedures, future: key escrow     |
| Backend failure        | Medium - service outage   | Health checks, fallback backends              |
| Performance bottleneck | Medium - slow ops         | Benchmark early, optimize hot paths           |
| Header tampering       | High - security breach    | AEAD via TweetNaCl, content hash verification |
| CBOR vulnerabilities   | Low - parsing issues      | Use well-maintained library, size limits      |

---

## Open Questions for Implementation

1. **Key storage location** - In-memory only or persist to disk?

   - **Recommendation:** In-memory for MVP, add encrypted persistence post-MVP

2. **Concurrent upload handling** - What if same content uploaded twice?

   - **Recommendation:** Idempotent - same contentHash returned

3. **Partial upload failure** - Retry logic?

   - **Recommendation:** Defer to post-MVP, fail fast for now

4. **Metadata size limits** - Max metadata bytes?

   - **Recommendation:** 64KB limit, enforce in header builder

5. **Key fingerprint collisions** - SHA-256 sufficient?
   - **Recommendation:** Yes, 2^256 space is collision-resistant

---

**Document Status:** ✅ DEFINITIVE - Ready for Implementation
**Next Step:** Begin Phase 1 implementation (Core Crypto)

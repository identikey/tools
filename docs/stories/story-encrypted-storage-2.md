# Story: Storage Backend and API

Status: Ready-for-Dev

## Story

As a **developer using IdentiKey Tools**,
I want **a unified API for encrypted storage with pluggable backends**,
so that **I can store/retrieve encrypted blobs via content hash without coupling to a specific storage system**.

## Acceptance Criteria

1. **AC1:** `StorageAdapter` interface defines `put(key, data)`, `get(key)`, `exists(key)`, `delete(key)` methods
2. **AC2:** `MinioAdapter` implements StorageAdapter using MinIO client v7.1.3
3. **AC3:** MinioAdapter PUT stores blob at content hash key, returns void on success
4. **AC4:** MinioAdapter GET retrieves blob by content hash, returns Buffer
5. **AC5:** MinioAdapter EXISTS checks blob presence, returns boolean
6. **AC6:** MinioAdapter DELETE removes blob by content hash
7. **AC7:** `EncryptedStorage.put(plaintext, publicKey, metadata?)` encrypts, builds header, stores blob, returns content hash
8. **AC8:** `EncryptedStorage.get(contentHash, privateKey?)` retrieves blob, parses header, looks up key by fingerprint, decrypts, verifies checksum if present
9. **AC9:** `EncryptedStorage.getMetadata(contentHash)` returns metadata without decrypting ciphertext
10. **AC10:** `EncryptedStorage.exists(contentHash)` proxies to storage backend
11. **AC11:** `EncryptedStorage.delete(contentHash)` proxies to storage backend
12. **AC12:** `KeyManager` class stores keypairs indexed by fingerprint, provides `addKey()` and `getPrivateKey(fingerprint)` methods
13. **AC13:** Integration test: full E2E flow (put → get → verify plaintext matches) against local MinIO
14. **AC14:** Error handling: key not found throws descriptive error; backend failures propagate correctly
15. **AC15:** Content hash = SHA-256(complete blob including header), verifiable on retrieval

## Tasks / Subtasks

### Phase 1: Storage Adapter Interface (AC: #1)

- [ ] Create `src/storage/adapter.ts` with StorageAdapter interface definition (AC: #1)
- [ ] Create `src/types/storage-config.ts` with MinioConfig and StorageConfig types (AC: #1)
- [ ] Document interface contract (put/get/exists/delete semantics) (AC: #1)

### Phase 2: MinIO Adapter Implementation (AC: #2, #3, #4, #5, #6)

- [ ] Install dependency: `bun add minio` (AC: #2)
- [ ] Create `src/storage/minio-adapter.ts` implementing StorageAdapter (AC: #2)
- [ ] Implement `put(key, data)`: upload blob to bucket at key (AC: #3)
- [ ] Implement `get(key)`: download blob, convert stream to Buffer (AC: #4)
- [ ] Implement `exists(key)`: use statObject, catch 404, return boolean (AC: #5)
- [ ] Implement `delete(key)`: call removeObject (AC: #6)
- [ ] Add MinIO client configuration via environment variables (AC: #2)
- [ ] Write unit tests: `tests/unit/storage/minio-adapter.test.ts` (mock MinIO client) (AC: #3, #4, #5, #6)

### Phase 3: Main EncryptedStorage API (AC: #7, #8, #9, #10, #11, #15)

- [ ] Create `src/api/encrypted-storage.ts` with EncryptedStorage class (AC: #7)
- [ ] Implement `put()`: encrypt → buildHeader → concat → SHA-256 hash → storage.put() (AC: #7, #15)
- [ ] Implement `get()`: storage.get() → parseHeader → lookup key → decrypt → verify checksum (AC: #8, #15)
- [ ] Implement `getMetadata()`: storage.get() → parseHeader → return metadata only (AC: #9)
- [ ] Implement `exists()`: proxy to storage.exists() (AC: #10)
- [ ] Implement `delete()`: proxy to storage.delete() (AC: #11)
- [ ] Add SHA-256 utility for content hash computation (AC: #15)
- [ ] Write unit tests: `tests/unit/api/encrypted-storage.test.ts` (mock storage adapter) (AC: #7-#11)

### Phase 4: Key Management Enhancement (AC: #12, #14)

- [ ] Enhance `src/keypair.ts` with KeyManager class (AC: #12)
- [ ] Implement `addKey(publicKey, privateKey)`: compute fingerprint, store in Map (AC: #12)
- [ ] Implement `getPrivateKey(fingerprint)`: lookup from Map, throw if not found (AC: #12, #14)
- [ ] Implement `hasKey(fingerprint)`: check Map membership (AC: #12)
- [ ] Write unit tests: `tests/unit/keypair.test.ts` (expand existing tests) (AC: #12, #14)

### Phase 5: Integration Testing (AC: #13, #14)

- [ ] Setup Docker Compose with MinIO service for tests (AC: #13)
- [ ] Create `.env.test` with MinIO connection config (AC: #13)
- [ ] Write `tests/integration/e2e-flow.test.ts`: put → get → verify (AC: #13)
- [ ] Write `tests/integration/minio.test.ts`: MinIO CRUD operations (AC: #13)
- [ ] Test error scenarios: missing key, backend unavailable, corrupted blob (AC: #14)
- [ ] Test large file handling (>10MB blob) (AC: #13)
- [ ] Test concurrent operations (multiple puts/gets) (AC: #13)

### Phase 6: Configuration and Documentation (AC: #2)

- [ ] Create `.env.local.example` with MinIO config template (AC: #2)
- [ ] Document MinIO Docker setup in tech spec or README (AC: #2)
- [ ] Add environment variable validation on EncryptedStorage initialization (AC: #2)

## Dev Notes

### Technical Summary

Implements the storage layer and main API, connecting the encryption primitives (Story 1) to a pluggable backend architecture. MinIO adapter is the default backend (S3-compatible, local dev-friendly). The EncryptedStorage class orchestrates the full workflow: encryption → header building → content hashing → storage → retrieval → decryption. KeyManager provides fingerprint-based key lookup to automatically select the correct private key for decryption.

**Content Hash Computation:**

```typescript
// After building complete blob (header + ciphertext)
const blob = Buffer.concat([header, ciphertext]);
const contentHash = createHash("sha256").update(blob).digest("hex");
```

**Key Design Decisions:**

- Hash complete blob (header + ciphertext), not plaintext - prevents correlation attacks
- Embed key fingerprint in header - enables automatic key selection during decryption
- Optional plaintext checksum in metadata - post-decrypt integrity verification
- Backend-agnostic interface - swap MinIO for S3 or filesystem via adapter pattern

### Project Structure Notes

- **Files to create:**

  - `src/storage/adapter.ts`
  - `src/storage/minio-adapter.ts`
  - `src/api/encrypted-storage.ts`
  - `src/types/storage-config.ts`
  - `.env.local.example`
  - `docker-compose.yml` (MinIO service)

- **Files to modify:**

  - `src/keypair.ts` (add KeyManager class)

- **Expected test locations:**

  - `tests/unit/storage/minio-adapter.test.ts`
  - `tests/unit/api/encrypted-storage.test.ts`
  - `tests/integration/e2e-flow.test.ts`
  - `tests/integration/minio.test.ts`
  - `tests/integration/large-files.test.ts`

- **Estimated effort:** 5 story points (1 week, ~8-10 hours)

### References

- **Tech Spec:** See `docs/tech-spec.md` - Phase 3 (Storage Backend) and Phase 4 (Main API)
- **Architecture:** `docs/architecture/content-addressable-encrypted-storage.md` - Sections: Storage Flow, Retrieval Flow, Component Architecture, API Design

## Dev Agent Record

### Context Reference

- `docs/stories/1-2-storage-backend-and-api.context.xml`

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes List

<!-- Will be populated during dev-story execution -->

### File List

<!-- Will be populated during dev-story execution -->

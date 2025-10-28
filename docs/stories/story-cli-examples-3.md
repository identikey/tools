# Story: Complex Example App

Status: Draft

## Story

As a **developer implementing production encryption workflows**,
I want **comprehensive examples showing real-world usage patterns**,
so that **I can adapt proven patterns for encrypting, storing, and retrieving sensitive data at scale**.

## Acceptance Criteria

1. **AC1:** `examples/complex/` directory exists with full dependencies (identikey-tools + minio)
2. **AC2:** `examples/complex/setup-minio.ts` validates MinIO connection and creates test bucket
3. **AC3:** `examples/complex/full-workflow.ts` demonstrates complete cycle: keygen → encrypt → store → retrieve → decrypt → verify
4. **AC4:** `examples/complex/batch-encrypt.ts` encrypts multiple files with progress indication
5. **AC5:** `examples/complex/key-rotation.ts` demonstrates migrating encrypted data to new keypair
6. **AC6:** `examples/complex/README.md` documents prerequisites, setup, and all example scripts
7. **AC7:** `.env.example` template provided with MinIO configuration variables
8. **AC8:** Full workflow completes in < 5 seconds with local MinIO
9. **AC9:** All scripts include performance metrics (timing, throughput)
10. **AC10:** Error handling demonstrates best practices (connection failures, key mismatches, corrupted data)
11. **AC11:** Examples use environment variables for configuration (no hardcoded credentials)
12. **AC12:** Integration tests validate examples against real MinIO instance

## Tasks / Subtasks

### Phase 1: Directory Structure & Configuration (AC: #1, #7, #11)

- [ ] Create `examples/complex/` directory (AC: #1)
- [ ] Create `examples/complex/package.json` with dependencies: identikey-tools, minio, dotenv (AC: #1)
- [ ] Create `examples/complex/.env.example` with MinIO config template (AC: #7)
- [ ] Document env vars: MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET (AC: #7)
- [ ] Add `dotenv/config` import to load environment variables (AC: #11)
- [ ] Create `.gitignore` to exclude .env, generated keys, encrypted files (AC: #1)
- [ ] Add scripts to package.json for each example (AC: #1)

### Phase 2: MinIO Setup Script (AC: #2, #10, #11)

- [ ] Create `examples/complex/setup-minio.ts` (AC: #2)
- [ ] Import MinioAdapter from 'identikey-tools/storage' (AC: #2)
- [ ] Load MinIO config from environment variables (AC: #11)
- [ ] Create MinIO client and test connection (AC: #2)
- [ ] Check if bucket exists, create if not (AC: #2)
- [ ] Display connection status and bucket info (AC: #2)
- [ ] Implement error handling: connection timeout, auth failure, invalid endpoint (AC: #10)
- [ ] Add timing metrics for connection test (AC: #9)

### Phase 3: Full Workflow Script (AC: #3, #8, #9, #10)

- [ ] Create `examples/complex/full-workflow.ts` (AC: #3)
- [ ] Step 1: Generate keypair with KeyManager (AC: #3)
- [ ] Step 2: Connect to MinIO storage (AC: #3)
- [ ] Step 3: Create EncryptedStorage instance (AC: #3)
- [ ] Step 4: Encrypt plaintext and store with metadata (AC: #3)
- [ ] Step 5: Retrieve blob by content hash (AC: #3)
- [ ] Step 6: Decrypt and verify plaintext matches (AC: #3)
- [ ] Step 7: Display blob metadata using getMetadata() (AC: #3)
- [ ] Add performance metrics: timing for each step, total duration (AC: #9)
- [ ] Display results in formatted table (AC: #3)
- [ ] Implement error handling at each step (AC: #10)
- [ ] Verify total execution < 5 seconds (AC: #8)

### Phase 4: Batch Encrypt Script (AC: #4, #9, #10)

- [ ] Create `examples/complex/batch-encrypt.ts` (AC: #4)
- [ ] Accept file glob pattern as CLI argument (e.g., `./files/*.txt`) (AC: #4)
- [ ] Read all matching files (AC: #4)
- [ ] Display progress bar using Ora or similar (AC: #4)
- [ ] Encrypt each file with EncryptedStorage.put() (AC: #4)
- [ ] Store content hashes in array (AC: #4)
- [ ] Display summary: total files, total size, total time, throughput (AC: #9)
- [ ] Implement parallel encryption (Promise.all) for performance (AC: #9)
- [ ] Handle errors: file read failures, encryption errors (AC: #10)
- [ ] Save content hashes to JSON manifest file (AC: #4)

### Phase 5: Key Rotation Script (AC: #5, #9, #10)

- [ ] Create `examples/complex/key-rotation.ts` (AC: #5)
- [ ] Accept arguments: old-key-path, new-key-path, content-hash (AC: #5)
- [ ] Load old keypair and new keypair (AC: #5)
- [ ] Retrieve blob using old private key (AC: #5)
- [ ] Decrypt with old key → plaintext (AC: #5)
- [ ] Encrypt plaintext with new public key (AC: #5)
- [ ] Store new blob, get new content hash (AC: #5)
- [ ] Display old hash vs new hash (AC: #5)
- [ ] Add timing metrics for rotation process (AC: #9)
- [ ] Implement error handling: old key mismatch, storage failures (AC: #10)
- [ ] Document use case: key compromise recovery, key expiration (AC: #6)

### Phase 6: README Documentation (AC: #6)

- [ ] Create `examples/complex/README.md` (AC: #6)
- [ ] Add title: "Complex Example - Full Encryption Workflow" (AC: #6)
- [ ] Document prerequisites: MinIO running, .env configured (AC: #6)
- [ ] Add MinIO Docker setup instructions (quick reference) (AC: #6)
- [ ] Document each example script with purpose and usage (AC: #6)
- [ ] Add "Full Workflow" section: step-by-step explanation (AC: #6)
- [ ] Add "Batch Operations" section: encrypting multiple files (AC: #6)
- [ ] Add "Key Rotation" section: migrating to new keys (AC: #6)
- [ ] Include expected output examples (AC: #6)
- [ ] Add troubleshooting section: common errors and solutions (AC: #6)

### Phase 7: Integration Testing (AC: #8, #12)

- [ ] Create `tests/examples/complex.test.ts` (AC: #12)
- [ ] Setup test MinIO instance (Docker container in CI) (AC: #12)
- [ ] Test setup-minio.ts: validates connection, creates bucket (AC: #12)
- [ ] Test full-workflow.ts: runs successfully, verifies output (AC: #12)
- [ ] Test batch-encrypt.ts: encrypts test files, checks manifest (AC: #12)
- [ ] Test key-rotation.ts: rotates key, verifies new blob decrypts (AC: #12)
- [ ] Validate performance: full workflow < 5 seconds (AC: #8)
- [ ] Test error scenarios: MinIO down, invalid keys (AC: #10)
- [ ] Cleanup test data after each test (AC: #12)

## Dev Notes

### Technical Summary

Creates production-ready examples demonstrating real-world patterns: full encryption workflows with MinIO storage, batch operations with progress indicators, and key rotation for security best practices. All scripts include comprehensive error handling, performance metrics, and detailed output to serve as reference implementations.

**Example Structure:**

```
examples/complex/
├── README.md              # Complete guide
├── package.json           # Full dependencies
├── .env.example           # Config template
├── setup-minio.ts         # Connection validation
├── full-workflow.ts       # End-to-end demo
├── batch-encrypt.ts       # Multiple files
└── key-rotation.ts        # Key migration pattern
```

**Full Workflow Pattern (full-workflow.ts):**

```typescript
// 1. Setup
const keypair = generateKeyPair();
const keyManager = new KeyManager();
keyManager.addKey(keypair.publicKey, keypair.secretKey);

const storage = new MinioAdapter({
  /* config */
});
const encryptedStorage = new EncryptedStorage(storage, keyManager);

// 2. Encrypt + Store
const plaintext = Buffer.from("Secret data");
const contentHash = await encryptedStorage.put(plaintext, keypair.publicKey, {
  originalFilename: "secret.txt",
  contentType: "text/plain",
});

// 3. Retrieve + Decrypt
const decrypted = await encryptedStorage.get(contentHash);

// 4. Verify
console.log(plaintext.equals(decrypted) ? "✓ Verified" : "✗ Mismatch");

// 5. Metadata
const metadata = await encryptedStorage.getMetadata(contentHash);
console.table(metadata);
```

**Performance Metrics Pattern:**

```typescript
const start = performance.now();
// ... operation ...
const duration = performance.now() - start;

console.log(`Completed in ${duration.toFixed(2)}ms`);
console.log(
  `Throughput: ${(((dataSize / duration) * 1000) / 1024 / 1024).toFixed(
    2
  )} MB/s`
);
```

### Project Structure Notes

- **Files to create:**

  - `examples/complex/package.json`
  - `examples/complex/.env.example`
  - `examples/complex/README.md`
  - `examples/complex/setup-minio.ts`
  - `examples/complex/full-workflow.ts`
  - `examples/complex/batch-encrypt.ts`
  - `examples/complex/key-rotation.ts`
  - `examples/complex/.gitignore`

- **Files to modify:**

  - None (standalone example)

- **Expected test locations:**

  - `tests/examples/complex.test.ts`
  - Docker Compose or CI config for test MinIO

- **Estimated effort:** 3 story points (2-3 days)

### References

- **Tech Spec:** See `docs/tech-spec-cli-examples.md` - Complex Example Implementation section
- **Pattern:** AWS SDK examples, Stripe API guides (production-ready patterns)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes List

<!-- Will be populated during dev-story execution -->

### File List

<!-- Will be populated during dev-story execution -->

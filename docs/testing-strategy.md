# Testing Strategy

## Overview

Tests are organized in a three-tier pyramid: **Unit → Integration → E2E**.

```
         ▲
        E2E         (MinIO, network-dependent, CI only)
       ▲▲▲▲
      INTEGRATION   (FilesystemAdapter, offline)
    ▲▲▲▲▲▲▲▲
   UNIT TESTS       (MemoryAdapter, fast, no I/O)
 ▲▲▲▲▲▲▲▲▲▲▲▲
```

## Test Layers

### Unit Tests (Default)

**Adapter:** `MemoryAdapter` (in-memory, no I/O)  
**Location:** `src/`, `tests/security/`, `tests/benchmarks/`  
**Run:** `bun test` or `bun run test:unit`  
**Coverage:** 90+ tests

**What's tested:**

- Crypto primitives (encryption, decryption, key generation)
- Header serialization (CBOR, fingerprints, parsing)
- Key management (KeyManager, fingerprint lookup)
- Security properties (no plaintext correlation, AEAD, tampering detection)
- Performance baselines (hash throughput, crypto overhead)

**Why MemoryAdapter:**

- Zero network dependency → tests always pass offline
- Fast (< 2s for 90 tests)
- Deterministic (no race conditions, no flaky tests)
- Perfect for CI/CD

### Integration Tests (Optional)

**Adapter:** `FilesystemAdapter` (local disk, offline)  
**Location:** `tests/integration/` (future)  
**Run:** `bun run test:integration`

**What to test:**

- Streaming I/O (large files, backpressure)
- Concurrent access patterns
- Error mapping (ENOENT → NotFound, EEXIST → AlreadyExists)
- Cross-platform quirks (Windows vs Linux paths, permissions)

**Why FilesystemAdapter:**

- Still offline (no network flakiness)
- Tests real I/O behavior (disk latency, fsync, atomic writes)
- Validates storage adapter interface conformance

### End-to-End Tests (CI Only)

**Adapter:** `MinioAdapter` (real MinIO server)  
**Location:** `tests/e2e/`  
**Run:** `MINIO_ENDPOINT=localhost bun run test:e2e`  
**Gating:** Tests skip if `MINIO_ENDPOINT` not set

**What's tested:**

- Real network I/O (upload/download latency)
- MinIO-specific behavior (S3 API, bucket operations)
- Large file handling (10MB+)
- Concurrent uploads
- Real-world performance baselines

**Why MinIO in E2E only:**

- Network dependency → requires running service
- Slower (network latency, setup time)
- For validating production behavior, not core logic

## Running Tests

### Local Development (Default)

```bash
bun test
# or
bun run test:unit
```

✅ 99 tests pass, 8 E2E tests skip (no MinIO)

### With MinIO E2E

```bash
# Start MinIO
docker run -d -p 9000:9000 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data

# Run E2E tests
MINIO_ENDPOINT=localhost bun run test:e2e
```

✅ 8 E2E tests run against real MinIO

### All Tests (CI)

```bash
bun run test:all
```

✅ 107 tests (99 unit + 8 E2E)

### Coverage

```bash
bun run test:coverage
```

### Specific Suites

```bash
bun run test:security      # Security tests only
bun run test:benchmarks    # Performance benchmarks
```

## CI Configuration

GitHub Actions (`.github/workflows/ci.yml`):

- **Lint job:** TypeScript strict mode checks
- **Test job:** Unit tests (MemoryAdapter) + E2E (MinIO service container)
- **Coverage job:** Generate coverage report
- **Build job:** Verify package builds

MinIO service in CI:

```yaml
services:
  minio:
    image: minio/minio
    env:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - 9000:9000
```

## Storage Adapters

### MemoryAdapter

**Use for:** Unit tests, crypto benchmarks  
**Pros:** Fast, deterministic, no dependencies  
**Cons:** No I/O behavior testing  
**Example:**

```typescript
import { MemoryAdapter } from "@identikey/tools";

const adapter = new MemoryAdapter();
const storage = new EncryptedStorage(adapter, keyManager);
```

### FilesystemAdapter

**Use for:** Integration tests, local dev without MinIO  
**Pros:** Offline, real I/O, cross-platform  
**Cons:** Slower than memory, requires cleanup  
**Example:**

```typescript
import { FilesystemAdapter } from "@identikey/tools";

const adapter = new FilesystemAdapter({ rootDir: "/tmp/identikey" });
await adapter.ensureRoot();
const storage = new EncryptedStorage(adapter, keyManager);
```

**Features:**

- Atomic writes (temp file → fsync → rename)
- Path traversal protection (sanitizes keys)
- Cross-platform compatible (Windows, Linux, macOS)

### MinioAdapter

**Use for:** Production, E2E tests  
**Pros:** S3-compatible, scalable, production-ready  
**Cons:** Requires network service  
**Example:**

```typescript
import { MinioAdapter } from "@identikey/tools";

const adapter = new MinioAdapter({
  endpoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  bucket: "identikey-storage",
});
await adapter.ensureBucket();
```

## Test Isolation

**Key principle:** Tests must not depend on execution order.

- **MemoryAdapter:** `adapter.clear()` in `afterEach`
- **FilesystemAdapter:** Use `mkdtemp()` per test worker, `rm -rf` in `afterAll`
- **MinioAdapter:** Unique bucket per test suite, cleanup in `afterAll`

## Performance Targets

Validated in benchmarks (AC4, AC5, AC6):

| Metric                 | Target     | Measured (MemoryAdapter) | Status |
| ---------------------- | ---------- | ------------------------ | ------ |
| SHA-256 throughput     | > 100 MB/s | 1,894 MB/s               | ✅     |
| 1MB encrypt + store    | < 500ms    | ~20-30ms                 | ✅     |
| 1MB retrieve + decrypt | < 300ms    | ~20-30ms                 | ✅     |

**Note:** MinIO E2E latency includes network overhead (~50-100ms local).

## Security Validation

All security tests (AC1, AC2, AC3) use `MemoryAdapter`:

- **AC1:** No plaintext correlation via content hashing ✅
- **AC2:** AEAD authentication detects header tampering ✅
- **AC3:** Clear error messages for corrupted ciphertext ✅

## Future Enhancements

### Adapter Conformance Suite

Parameterized tests that run against all adapters:

```typescript
const adaptersUnderTest = [
  new MemoryAdapter(),
  new FilesystemAdapter({ rootDir: tmpdir }),
];

for (const adapter of adaptersUnderTest) {
  describe(`Adapter: ${adapter.constructor.name}`, () => {
    // Standard conformance tests
  });
}
```

### Fault Injection Adapter

Wrapper for testing error paths:

```typescript
const faultyAdapter = new FaultInjectionAdapter(baseAdapter);
faultyAdapter.injectFailure("put", new Error("Network timeout"));

// Test retry logic, error handling, etc.
```

### Benchmark Isolation

Split benchmarks by dependency:

- `benchmarks/crypto/` - Pure crypto (no storage)
- `benchmarks/storage/` - I/O benchmarks (opt-in, requires storage backend)

## References

- [Martin Fowler: Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Adapter Pattern (GoF)](https://en.wikipedia.org/wiki/Adapter_pattern)
- [TweetNaCl Security Audit](https://tweetnacl.cr.yp.to/)
- [S3 API Compatibility](https://min.io/docs/minio/linux/integrations/aws-cli-with-minio.html)

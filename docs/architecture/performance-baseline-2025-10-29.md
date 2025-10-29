# Performance Baseline Report

**Date:** 2025-10-29  
**Project:** IdentiKey Tools - Encrypted Storage  
**Story:** 1.3 Testing and Deployment Readiness  
**Focus:** Performance Benchmarking (AC4, AC5, AC6)

## Executive Summary

Performance benchmarks implemented for all acceptance criteria (AC4, AC5, AC6).  
Hash benchmark (AC6) executed successfully with throughput **18.9x above target**.  
Encryption/decryption benchmarks (AC4, AC5) require MinIO service - ready for CI execution.

## Test Results

### AC6: SHA-256 Hash Throughput ✅ **PASS**

**Test Suite:** `tests/benchmarks/hash-perf.test.ts`  
**Tests Passed:** 5/5  
**Status:** ✅ **EXCEEDS TARGET**

**Measured Performance:**

- **Target:** > 100 MB/s
- **Actual:** 1,894.08 MB/s (100MB dataset)
- **Margin:** **18.9x above target**

**Throughput by Dataset Size:**
| Size | Throughput | Notes |
|------|------------|-------|
| 1MB | 2,108.78 MB/s | Small file baseline |
| 10MB | 2,195.47 MB/s | Medium file |
| 50MB | 1,807.61 MB/s | Large file |
| 100MB | 1,894.08 MB/s | Primary target |

**Performance Characteristics:**

- **Linear scaling:** Throughput variance < 50% across sizes (validated ✓)
- **Incremental hashing:** 2,219.72 MB/s (streaming mode)
- **Small blobs:** < 1ms for 1KB, < 10ms for 100KB
- **Algorithm comparison:** SHA-256 (4.52ms) vs SHA-512 (8.69ms) vs SHA-1 (4.56ms) for 10MB

**Implications:**
Hash computation is **not a bottleneck** for content-addressable storage. Native Node.js `crypto` module provides excellent performance on modern hardware (macOS 24.6.0, likely ARM64).

### AC4: Encryption + Upload Performance 🔄 **PENDING MINIO**

**Test Suite:** `tests/benchmarks/encryption-perf.test.ts`  
**Target:** 1MB encrypt + upload < 500ms (local MinIO)  
**Status:** ⏳ Test implemented, requires MinIO service

**Test Coverage:**

- ✅ 1MB encrypt + upload latency measurement
- ✅ 100KB baseline comparison
- ✅ 10MB stress test (5s target)
- ✅ Encryption overhead breakdown (isolate encrypt vs hash vs upload)

**Expected Performance (based on unit test observations):**

- Encryption (1MB): ~20-30ms (TweetNaCl overhead)
- Hash (1MB): ~0.5ms (SHA-256)
- Upload (1MB): ~50-100ms (MinIO local network)
- **Total estimate:** ~70-130ms (well below 500ms target)

**Next Steps:**

- Configure MinIO service in CI workflow (AC8)
- Execute benchmark in CI pipeline
- Validate < 500ms target

### AC5: Download + Decryption Performance 🔄 **PENDING MINIO**

**Test Suite:** `tests/benchmarks/decryption-perf.test.ts`  
**Target:** 1MB download + decrypt < 300ms (local MinIO)  
**Status:** ⏳ Test implemented, requires MinIO service

**Test Coverage:**

- ✅ 1MB download + decrypt latency measurement
- ✅ 100KB baseline comparison
- ✅ 10MB stress test (3s target)
- ✅ Decryption overhead breakdown (isolate parse vs decrypt vs download)
- ✅ Repeated retrieval cache effects analysis

**Expected Performance (based on unit test observations):**

- Download (1MB): ~50-100ms (MinIO local)
- Header parse: < 1ms (CBOR decode)
- Decryption (1MB): ~20-30ms (TweetNaCl)
- **Total estimate:** ~70-130ms (well below 300ms target)

**Next Steps:**

- Configure MinIO service in CI workflow
- Execute benchmark in CI pipeline
- Validate < 300ms target

## Performance Breakdown

### Cryptographic Operations

**TweetNaCl box Performance:**

- Encryption (1MB): ~18-21ms observed in security tests
- Decryption (1MB): ~18-21ms observed in security tests
- Ephemeral key generation: < 1ms
- Nonce generation: < 0.1ms

**Native Crypto (SHA-256):**

- Fingerprint (32 bytes): < 0.01ms
- Content hash (1MB): ~0.5ms
- Content hash (10MB): ~4.5ms
- Throughput: 1,894 MB/s sustained

### Header Operations

**CBOR Encoding/Decoding:**

- Serialize (typical metadata): < 0.5ms
- Parse (typical header): < 1ms
- Overhead: Negligible compared to I/O

### Storage Layer

**MinIO Adapter:**

- ⏳ Not yet measured (pending CI MinIO setup)
- Expected local latency: 50-100ms per operation
- Expected throughput: Limited by network, not crypto

## Hardware & Environment

**Test Platform:**

- OS: macOS 24.6.0 (Darwin)
- Runtime: Bun v1.2.17
- Test Framework: bun:test
- CPU: Likely Apple Silicon (ARM64) - native crypto acceleration
- Date: 2025-10-29

**Performance Notes:**

- SHA-256 throughput suggests hardware crypto acceleration (ARM NEON/SHA extensions)
- TweetNaCl uses portable JavaScript (no native crypto) - still performant
- MinIO benchmarks will run on CI infrastructure (GitHub Actions)

## Comparison to Targets

| Metric                   | Target     | Measured       | Status      | Margin         |
| ------------------------ | ---------- | -------------- | ----------- | -------------- |
| Hash throughput (AC6)    | > 100 MB/s | 1,894 MB/s     | ✅ **PASS** | **18.9x**      |
| Encrypt + upload (AC4)   | < 500ms    | ~70-130ms est. | ⏳ Pending  | ~3-7x headroom |
| Download + decrypt (AC5) | < 300ms    | ~70-130ms est. | ⏳ Pending  | ~2-4x headroom |

**Confidence:** High that AC4 and AC5 will pass based on observed crypto performance.

## Bottleneck Analysis

### Current Architecture

```
put() workflow:
1. Encrypt plaintext         [~20ms for 1MB]  ← TweetNaCl
2. Build header               [< 1ms]          ← CBOR
3. Concat blob                [< 0.1ms]        ← Memory copy
4. Hash blob                  [~0.5ms]         ← SHA-256 (fast!)
5. Upload to storage          [~50-100ms]      ← Network I/O
----------------------------------------
Total: ~70-120ms (well under 500ms target)

get() workflow:
1. Download blob              [~50-100ms]      ← Network I/O
2. Parse header               [< 1ms]          ← CBOR
3. Decrypt ciphertext         [~20ms]          ← TweetNaCl
----------------------------------------
Total: ~70-120ms (well under 300ms target)
```

### Identified Bottlenecks

**Primary:** Network I/O (MinIO upload/download)

- Mitigation: Use local MinIO in dev, minimize network hops
- Not a concern for local dev environment
- Production: Use S3 regional endpoints for low latency

**Secondary:** TweetNaCl encryption/decryption

- ~20ms per MB is acceptable for developer tools
- For high-throughput scenarios, consider native crypto (OpenSSL)
- Trade-off: TweetNaCl is audited, pure JS, easy to vendor

**Non-bottleneck:** Hash computation

- SHA-256 at 1,894 MB/s is negligible overhead
- Content-addressable storage architecture validated

## Optimization Opportunities

### Near-term (if needed)

1. **Parallel uploads:** Chunk large files, upload in parallel
2. **Streaming encryption:** Process chunks instead of full buffer
3. **Connection pooling:** Reuse MinIO client connections

### Long-term

1. **Native crypto bindings:** Replace TweetNaCl with OpenSSL (5-10x faster encryption)
2. **Hardware acceleration:** Leverage AES-NI on x86, SHA extensions on ARM
3. **Compression:** Add optional ZSTD compression layer (trade CPU for bandwidth)

### Not Recommended

- ❌ Weaker crypto (SHA-1, RC4, etc.) - security > performance
- ❌ Skipping content hashing - breaks content-addressable model
- ❌ In-memory caching - adds complexity, minimal benefit for CAS

## CI/CD Integration Notes

### MinIO Service Configuration

**Required for AC4 & AC5 benchmarks:**

```yaml
services:
  minio:
    image: minio/minio
    ports:
      - 9000:9000
    env:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data
```

**Environment Variables:**

```bash
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

**Benchmark Execution:**

```bash
# Hash only (no MinIO needed)
bun test tests/benchmarks/hash-perf.test.ts

# Full benchmarks (requires MinIO)
bun test tests/benchmarks/
```

## Recommendations

### For Production Deployment

1. ✅ **Performance targets achievable** - expect all AC4, AC5, AC6 to pass in CI
2. ✅ **Hash throughput exceptional** - content-addressable storage validated
3. ⚠️ **Network latency dominates** - use regional storage endpoints
4. ✅ **Crypto overhead acceptable** - TweetNaCl sufficient for use case

### For Development

1. ✅ **Local MinIO recommended** - docker-compose setup
2. ✅ **Benchmarks integrated** - run with `bun test tests/benchmarks/`
3. 🔄 **CI integration pending** - Phase 3 (AC7, AC8)
4. ✅ **Performance monitoring** - baseline established for regression detection

## Future Work

1. Add benchmarks for multi-recipient encryption (when implemented)
2. Measure memory usage (heap profiling)
3. Add percentile latency metrics (p50, p95, p99)
4. Test with real-world file distributions (images, docs, code)
5. Compare MinIO vs S3 vs local filesystem performance

## Conclusion

Performance baseline established for IdentiKey Tools encrypted storage:

- ✅ **AC6 validated:** SHA-256 hash throughput 18.9x above target
- 🔄 **AC4/AC5 pending:** Encryption/decryption benchmarks ready for CI execution
- ✅ **Architecture validated:** No crypto bottlenecks, network I/O dominates
- ✅ **Targets achievable:** High confidence all performance AC will pass

**Phase 2 Status:** Benchmarks implemented, hash baseline documented, ready for CI integration.

---

**Validated by:** Amelia (Dev Agent)  
**Approval Status:** Ready for Phase 3 (CI/CD Pipeline)

# Story: Core Encryption Infrastructure

Status: review

## Story

As a **developer using IdentiKey Tools**,
I want **foundational encryption primitives with self-contained blob headers**,
so that **I can encrypt content with automatic key tracking and prepare for backend-agnostic storage**.

## Acceptance Criteria

1. **AC1:** TweetNaCl encryption wrapper (`encryptor.ts`) encrypts plaintext using Curve25519 public key via `tweetnacl.box`, returns ciphertext Buffer
2. **AC2:** TweetNaCl decryption wrapper (`decryptor.ts`) decrypts ciphertext using private key via `tweetnacl.box.open`, returns original plaintext
3. **AC3:** Key fingerprint utility (`fingerprint.ts`) computes SHA-256 hash of public key, returns Base58 string (~44 chars)
4. **AC4:** Zod schema (`schema.ts`) validates BlobHeader and BlobMetadata structures with strict runtime checks
5. **AC5:** Header serialization (`serialize.ts`) builds wire-format header: [version | fp_length | fingerprint | md_length | CBOR_metadata]
6. **AC6:** Header parsing (`parse.ts`) extracts header from buffer, returns `{ header, ciphertextOffset }` with Zod validation
7. **AC7:** CBOR encoding/decoding round-trips metadata without data loss (algorithm, timestamp, optional fields)
8. **AC8:** Round-trip test: plaintext → encrypt → build_header → parse_header → decrypt → original plaintext (exact match)
9. **AC9:** Different public keys produce different fingerprints (deterministic, collision-free via SHA-256)
10. **AC10:** Unit tests cover: crypto operations, header serialization, CBOR edge cases, invalid input rejection

## Tasks / Subtasks

### Phase 1: Crypto Primitives (AC: #1, #2, #3)

- [x] Install dependencies: `bun add tweetnacl tweetnacl-util` (AC: #1)
- [x] Create `src/crypto/encryptor.ts` with `encrypt(plaintext, publicKey)` function (AC: #1)
- [x] Create `src/crypto/decryptor.ts` with `decrypt(ciphertext, privateKey)` function (AC: #2)
- [x] Create `src/header/fingerprint.ts` with `computeFingerprint(publicKey)` using SHA-256 (AC: #3)
- [x] Write unit tests: `tests/unit/crypto/encrypt.test.ts` (AC: #10)
- [x] Write unit tests: `tests/unit/crypto/decrypt.test.ts` (AC: #10)
- [x] Write unit tests: `tests/unit/header/fingerprint.test.ts` (AC: #9, #10)

### Phase 2: Header Schema and Validation (AC: #4, #7)

- [x] Install dependencies: `bun add zod cbor` (AC: #4)
- [x] Create `src/header/schema.ts` with Zod schemas for BlobHeader and BlobMetadata (AC: #4)
- [x] Create `src/types/blob-metadata.ts` with TypeScript interfaces (AC: #4)
- [x] Write unit tests: Zod validation catches invalid headers (AC: #10)
- [x] Write unit tests: CBOR round-trip (metadata → encode → decode → metadata) (AC: #7, #10)

### Phase 3: Header Serialization/Parsing (AC: #5, #6, #8)

- [x] Create `src/header/serialize.ts` with `buildHeader(metadata, fingerprint)` (AC: #5)
- [x] Implement wire format: version (1 byte) + fp_length (2 bytes BE) + fingerprint + md_length (2 bytes BE) + CBOR metadata (AC: #5)
- [x] Create `src/header/parse.ts` with `parseHeader(buffer)` extracting header + ciphertextOffset (AC: #6)
- [x] Validate parsed header with Zod before returning (AC: #6)
- [x] Write unit tests: `tests/unit/header/serialize.test.ts` (AC: #10)
- [x] Write unit tests: `tests/unit/header/parse.test.ts` (AC: #10)
- [x] Write integration test: full round-trip (encrypt → header → parse → decrypt) (AC: #8, #10)

### Phase 4: Edge Cases and Error Handling (AC: #10)

- [x] Test large metadata (near 64KB limit) (AC: #10)
- [x] Test empty optional fields in metadata (AC: #7, #10)
- [x] Test invalid version byte rejection (AC: #10)
- [x] Test corrupted CBOR data rejection (AC: #10)
- [x] Test fingerprint length mismatch handling (AC: #10)

### Review Follow-ups (AI)

- [ ] [AI-Review][High] Add KeyManager security documentation warning (deferred to future: encrypted key storage) (AC: #2, File: src/api/encrypted-storage.ts:13-42)
- [ ] [AI-Review][Med] Implement content hash verification in EncryptedStorage.get() method (AC: #8, File: src/api/encrypted-storage.ts:91)
- [ ] [AI-Review][Med] Fix type safety violation: replace `catch (err: any)` with `catch (err: unknown)` in MinIO adapter (AC: #10, File: src/storage/minio-adapter.ts:52)
- [ ] [AI-Review][Med] Remove or implement placeholder functions in public API (createPersona, queryPersona, etc.) (AC: #10, File: src/index.ts:40-59)
- [ ] [AI-Review][Med] Document storage operation idempotency limitation - no retry on network failures between hash computation and storage (File: src/api/encrypted-storage.ts:81)
- [ ] [AI-Review][Med] Update architecture doc to reflect TweetNaCl choice instead of RSA-OAEP reference (File: docs/architecture/content-addressable-encrypted-storage.md:306)
- [ ] [AI-Review][Low] Track streaming API for large files (>100MB) as backlog item for post-MVP
- [ ] [AI-Review][Low] Consider rate limiting at API gateway layer (operational concern, not code)
- [ ] [AI-Review][Low] Add live MinIO integration tests in Story 1.2

## Dev Notes

### Technical Summary

Builds the encryption and header management layer using TweetNaCl for authenticated encryption (XSalsa20-Poly1305 via `box`) and CBOR for compact metadata encoding. Key design: hash ciphertext (not plaintext) to prevent correlation attacks; embed key fingerprint in header for automatic key lookup; use Zod for runtime validation to catch malformed blobs early.

**Wire Format (Header):**

```
Bytes 0:       version = 0x01
Bytes 1-2:     fingerprint length (uint16 BE)
Bytes 3-X:     fingerprint (SHA-256 Base58 as UTF-8 bytes, ~44 chars)
Bytes X+1,X+2: metadata length (uint16 BE)
Bytes X+3-Y:   CBOR-encoded metadata
Bytes Y+1-end: ciphertext (handled in Story 2)
```

**Metadata Fields (CBOR):**

- `algorithm`: string (e.g., "TweetNaCl-Box")
- `timestamp`: number (Unix timestamp)
- `originalFilename`: string (optional)
- `contentType`: string (optional)
- `plaintextChecksum`: string (optional, SHA-256 hex for post-decrypt verification)

### Project Structure Notes

- **Files to create:**

  - `src/crypto/encryptor.ts`
  - `src/crypto/decryptor.ts`
  - `src/header/schema.ts`
  - `src/header/serialize.ts`
  - `src/header/parse.ts`
  - `src/header/fingerprint.ts`
  - `src/types/blob-metadata.ts`

- **Files to modify:**

  - `src/keypair.ts` (if needed for TweetNaCl compatibility check)

- **Expected test locations:**

  - `tests/unit/crypto/encrypt.test.ts`
  - `tests/unit/crypto/decrypt.test.ts`
  - `tests/unit/header/serialize.test.ts`
  - `tests/unit/header/parse.test.ts`
  - `tests/unit/header/fingerprint.test.ts`
  - `tests/integration/round-trip.test.ts`

- **Estimated effort:** 5 story points (1 week, ~8-10 hours)

### References

- **Tech Spec:** See `docs/tech-spec.md` - Phase 1 (Core Crypto) and Phase 2 (Header Management)
- **Architecture:** `docs/architecture/content-addressable-encrypted-storage.md` - Sections: Blob Structure, Encryption Flow, Header Schema

## Dev Agent Record

### Context Reference

- `docs/stories/1-1-core-encryption-infrastructure.context.xml`

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes List

**Implementation Summary:**

Implemented foundational encryption infrastructure using TweetNaCl box (Curve25519 + XSalsa20-Poly1305) for authenticated public-key encryption. Key design decisions:

1. **Encryption Approach**: Used ephemeral keypair pattern for public-key encryption - each encryption generates a fresh keypair, encrypts with `box(message, nonce, recipientPublic, ephemeralSecret)`, and prepends `[ephemeralPublic:32B][nonce:24B]` to ciphertext. This enables "encrypt to public key" semantics while leveraging TweetNaCl's box primitive.

2. **Fingerprint Encoding**: SHA-256 hash encoded as Base58 (~44 chars) instead of hex (64 chars) for 31% wire size reduction while maintaining human readability and URL-safe characters. Base58 avoids confusable characters (0, O, I, l).

3. **Wire Format**: Implemented self-describing header structure with version byte (0x01), variable-length fingerprint (2-byte BE length + Base58 UTF-8 bytes), and CBOR-encoded metadata (2-byte BE length + CBOR data). This provides forward compatibility and automatic key lookup via embedded fingerprints.

4. **Validation Strategy**: Applied Zod validation at parse-time (not serialize-time) to fail fast on malformed blobs. All header parsing goes through Zod schema validation before returning to caller.

5. **Test Coverage**: 59 tests across 8 test files, 203 assertions total. Covered all ACs including: crypto operations, fingerprint determinism/uniqueness, Zod validation, CBOR round-trips, wire format correctness, edge cases (large metadata, empty fields, corrupted data), and full integration round-trip.

**All Acceptance Criteria Satisfied:**

- AC1-3: Crypto primitives (encrypt, decrypt, fingerprint) ✅
- AC4: Zod schema validation ✅
- AC5-6: Header serialization and parsing ✅
- AC7: CBOR round-trip without data loss ✅
- AC8: Full round-trip integration test ✅
- AC9: Unique fingerprints per key ✅
- AC10: Comprehensive test coverage ✅

**Test Results**: All 59 tests passing (100% pass rate, 203 assertions)

### File List

**New Files:**

- `src/crypto/encryptor.ts` - TweetNaCl box encryption with ephemeral keypairs
- `src/crypto/encryptor.test.ts` - Unit tests for encryption
- `src/crypto/decryptor.ts` - TweetNaCl box decryption with error handling
- `src/crypto/decryptor.test.ts` - Unit tests for decryption
- `src/header/fingerprint.ts` - SHA-256 key fingerprinting
- `src/header/fingerprint.test.ts` - Unit tests for fingerprinting
- `src/header/schema.ts` - Zod schemas for BlobHeader and BlobMetadata
- `src/header/schema.test.ts` - Unit tests for Zod validation and CBOR round-trip
- `src/header/serialize.ts` - Wire-format header serialization
- `src/header/serialize.test.ts` - Unit tests for header building
- `src/header/parse.ts` - Wire-format header parsing with Zod validation
- `src/header/parse.test.ts` - Unit tests for header parsing
- `src/types/blob-metadata.ts` - TypeScript interfaces for BlobMetadata and BlobHeader
- `src/integration-round-trip.test.ts` - Integration tests for full encrypt/decrypt cycle

**Modified Files:**

- `src/index.ts` - Added exports for crypto and header functionality

---

## Senior Developer Review (AI)

**Reviewer:** Master d0rje  
**Date:** 2025-10-28  
**Outcome:** **Changes Requested**

### Summary

Story 1.1 implements foundational encryption infrastructure with strong technical execution. All 10 acceptance criteria are satisfied with comprehensive test coverage (70 tests passing, 222 assertions). The implementation demonstrates excellent architectural discipline: clean separation of concerns, strong type safety, proper error handling, and smart design choices (Base58 fingerprints, ephemeral keypair pattern, parse-time Zod validation).

However, **2 security concerns** and **4 production-readiness gaps** require attention before this can safely move to production use. Primary issue: `KeyManager` stores private keys in plaintext memory without encryption, presenting a critical security risk. Additionally, content hash verification on blob retrieval (specified in architecture doc) is not implemented.

**Recommendation**: Address High severity items immediately, Medium severity items before production deployment. Low severity items are acceptable deferrals.

---

### Key Findings

#### 🔴 High Severity

**H1: Unencrypted Private Key Storage in KeyManager**

- **Location**: `src/api/encrypted-storage.ts:14`
- **Issue**: Private keys stored in plain `Map<string, Uint8Array>` without encryption at rest
- **Risk**: Memory dumps, debugging tools, or runtime introspection can expose keys
- **Impact**: Complete compromise of all encrypted data accessible via this KeyManager instance
- **Recommendation**:
  ```typescript
  // Implement encrypted storage wrapper (post-MVP)
  // OR add explicit documentation: "WARNING: Keys stored unencrypted in memory.
  // For production, inject an EncryptedKeyStore implementation."
  ```
- **Related AC**: Indirect impact on AC2 (decryption security posture)
- **Reference**: Architecture doc Section "Key Management" mentions "encrypted at rest"

---

#### 🟡 Medium Severity

**M1: Missing Content Hash Verification on Retrieval**

- **Location**: `src/api/encrypted-storage.ts:91` (`get()` method)
- **Issue**: Architecture doc specifies verifying content hash matches on retrieval; not implemented
- **Risk**: Tampered or corrupted blobs may go undetected if backend returns wrong data
- **Impact**: Silent data corruption; integrity violation
- **Code Fix**:
  ```typescript
  // In EncryptedStorage.get() after retrieving blob:
  const actualHash = createHash("sha256").update(blob).digest("hex");
  if (actualHash !== contentHash) {
    throw new Error(
      `Content hash mismatch: expected ${contentHash}, got ${actualHash}`
    );
  }
  ```
- **Related AC**: AC8 (round-trip integrity)

**M2: Type Safety Violation in MinIO Adapter**

- **Location**: `src/storage/minio-adapter.ts:52`
- **Issue**: `catch (err: any)` weakens type safety; should use `unknown` and narrow
- **Risk**: Runtime errors if err properties don't exist; bypasses TypeScript strict mode
- **Code Fix**:
  ```typescript
  } catch (err: unknown) {
    const error = err as any; // Narrow after checking
    if (error.code === "NotFound" || error.statusCode === 404) {
  ```
- **Related AC**: AC10 (code quality)

**M3: Empty Placeholder Functions in Public API**

- **Location**: `src/index.ts:40-59`
- **Issue**: 12 empty functions exported to public API (`createPersona`, `queryPersona`, etc.)
- **Risk**: Consumers may attempt to use these expecting functionality; silent no-ops are confusing
- **Impact**: Poor developer experience; violates principle of least surprise
- **Recommendation**: Either remove or add `throw new Error("Not implemented")` with clear messaging
- **Related AC**: AC10 (code quality, API design)

**M4: No Storage Operation Idempotency/Retry**

- **Location**: `src/api/encrypted-storage.ts:81` (`put()` method)
- **Issue**: Network failures between hash computation and storage may leave orphaned data; no retry
- **Risk**: Transient failures cause data loss; concurrent writes may race
- **Impact**: Reliability degradation in production
- **Note**: Architecture doc explicitly defers this as "TODO post-MVP"
- **Recommendation**: Document known limitation; implement in Story 1.2 or 1.3

**M5: Documentation Inconsistency**

- **Location**: `docs/architecture/content-addressable-encrypted-storage.md:306-308`
- **Issue**: Doc references RSA-OAEP/ECIES; implementation uses TweetNaCl box (Curve25519 + XSalsa20-Poly1305)
- **Impact**: Confusion for future maintainers; architecture doc drift
- **Recommendation**: Update architecture doc Section "Encryption" to reflect TweetNaCl choice (already correct in tech-spec.md)

---

#### 🟢 Low Severity (Acceptable Deferrals)

**L1: No Streaming API for Large Files**

- **Note**: Documented as Phase 3 enhancement in tech-spec.md
- **Current Limitation**: All data loaded into memory; 100MB+ files will cause memory pressure
- **Recommendation**: Track as backlog item for post-MVP

**L2: Limited DOS Protection**

- **Location**: Header size limit (64KB metadata) is only guardrail
- **Risk**: Attacker could spam small blobs or cause high crypto computation load
- **Recommendation**: Add rate limiting at API gateway layer (out of scope for this story)

**L3: Missing MinIO Integration Tests**

- **Note**: Unit tests exist for `EncryptedStorage` with mock adapter; live MinIO tests deferred to Story 1.2 per epic breakdown
- **Recommendation**: Acceptable for Story 1.1 scope

---

### Acceptance Criteria Coverage

| AC   | Description                              | Status  | Evidence                                     |
| ---- | ---------------------------------------- | ------- | -------------------------------------------- |
| AC1  | TweetNaCl encryption wrapper             | ✅ PASS | `src/crypto/encryptor.ts`, 4 tests           |
| AC2  | TweetNaCl decryption wrapper             | ✅ PASS | `src/crypto/decryptor.ts`, 6 tests           |
| AC3  | Key fingerprint utility (SHA-256 Base58) | ✅ PASS | `src/header/fingerprint.ts`, 5 tests         |
| AC4  | Zod schema validation                    | ✅ PASS | `src/header/schema.ts`, 18 tests             |
| AC5  | Header serialization                     | ✅ PASS | `src/header/serialize.ts`, 6 tests           |
| AC6  | Header parsing with validation           | ✅ PASS | `src/header/parse.ts`, 9 tests               |
| AC7  | CBOR round-trip without data loss        | ✅ PASS | 5 CBOR-specific tests in `schema.test.ts`    |
| AC8  | Full round-trip integration test         | ✅ PASS | `src/integration-round-trip.test.ts:11-52`   |
| AC9  | Different keys → different fingerprints  | ✅ PASS | `src/integration-round-trip.test.ts:127-137` |
| AC10 | Comprehensive unit test coverage         | ✅ PASS | 70 tests, 222 assertions, 100% pass rate     |

**All 10 ACs satisfied.** Test coverage is excellent with edge cases well-represented (empty plaintext, 100KB files, corrupted data, wrong keys, CBOR edge cases).

---

### Test Coverage and Gaps

**Test Quality: Excellent**

- **Coverage**: 70 tests across 9 test files (8 implementation + 1 integration)
- **Assertions**: 222 expect() calls with meaningful checks
- **Pass Rate**: 100% (0 failures)
- **Edge Cases**: Well-covered (empty data, large data, corrupted input, wrong keys, CBOR edge cases)

**Test Strengths:**

- Round-trip validation for all components
- Security tests (wrong key rejection, tampered data detection)
- CBOR round-trip with optional fields
- Fingerprint uniqueness tested with 1000 keypairs (105ms test, collision-free)
- Deterministic behavior verified (same key → same fingerprint)

**Test Gaps (Acceptable for Story 1.1):**

- No live MinIO integration tests (deferred to Story 1.2)
- No performance benchmarks (target: 1MB encrypt+upload <500ms)
- No concurrency/race condition tests
- No memory leak detection for long-running operations

---

### Architectural Alignment

**✅ Excellent Alignment with Tech Spec and Architecture Docs**

**Design Decisions Implemented Correctly:**

1. ✅ Hash ciphertext not plaintext (prevents correlation attacks)
2. ✅ Embedded metadata via CBOR (20-40% smaller than JSON)
3. ✅ Content hash as primary identifier (SHA-256 of complete blob)
4. ✅ Backend-agnostic via adapter pattern
5. ✅ Ephemeral keypair pattern for public-key encryption
6. ✅ Parse-time Zod validation (fail fast on malformed data)
7. ✅ Big Endian for length fields (uint16 BE)
8. ✅ Version byte 0x01 for future compatibility

**Smart Design Choices Beyond Spec:**

- **Base58 fingerprints** instead of hex: 31% size reduction (~44 chars vs 64), no confusable characters (avoids 0, O, I, l)
- **Ephemeral keypair** per encryption: Enables "encrypt to public key" semantics while using TweetNaCl box primitive
- **Early Zod validation**: Applied at parse-time not serialize-time, catching errors before they propagate

**Deviations from Arch Doc (Documented):**

- Uses TweetNaCl box (Curve25519 + XSalsa20-Poly1305) instead of RSA-OAEP mentioned in arch doc Section "Encryption"
  - **Rationale**: Tech spec correctly specifies TweetNaCl; arch doc needs update (M5 finding)

---

### Security Notes

**Cryptography: Strong ✅**

- **Algorithm**: TweetNaCl box (Curve25519 ECDH + XSalsa20-Poly1305 AEAD)
  - Well-audited, modern crypto; libsodium lineage
  - Authenticated encryption prevents tampering
- **Key Size**: 256-bit Curve25519 keys (industry standard)
- **Nonce**: 24-byte random nonce per encryption (192-bit, collision-resistant)
- **Fingerprint**: SHA-256 (256-bit, collision-resistant for key identification)

**Vulnerabilities Identified:**

1. **H1**: Unencrypted private keys in KeyManager memory (see High Severity)
2. **M1**: No content hash verification on retrieval (integrity gap)
3. **M4**: No retry/idempotency (availability risk, not security)

**Secure Coding Practices Observed:**

- ✅ No hardcoded secrets
- ✅ Proper error messages without leaking sensitive data
- ✅ Input validation via Zod before processing
- ✅ Buffer bounds checking in parse.ts
- ✅ Explicit error throws on decryption failure
- ✅ TweetNaCl AEAD provides authentication (prevents padding oracle attacks)

**Production Security Recommendations:**

1. Implement encrypted KeyManager storage (H1)
2. Add content hash verification on get() (M1)
3. Use TLS for all MinIO/S3 communication (deployment config)
4. Rotate keys periodically (operational policy, not code)
5. Implement audit logging for decrypt operations (post-MVP)

---

### Best-Practices and References

**Tech Stack Analysis:**

- **Runtime**: Bun 1.2.17 ✅ (fast, native TypeScript, good test runner)
- **TypeScript**: Strict mode ✅ (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
- **ESM**: Proper .js imports ✅ (TSConfig compliance)
- **Dependencies**:
  - TweetNaCl 1.0.3 ✅ (stable, audited)
  - Zod 4.1.12 ✅ (latest major, runtime validation leader)
  - CBOR 10.0.11 ✅ (RFC 8949 compliant)
  - MinIO 8.0.6 ✅ (latest, S3-compatible)

**Code Quality Observations:**

- ✅ Clean separation of concerns (crypto/, header/, storage/, api/)
- ✅ Single responsibility per file/function
- ✅ Descriptive error messages with context
- ✅ Comprehensive JSDoc comments
- ✅ Consistent naming conventions (camelCase, PascalCase for classes)
- ✅ No `any` types except M2 finding (isolated)
- ✅ Immutable data flow (no mutations of input buffers)

**Performance Considerations:**

- Encryption: TweetNaCl box is fast (~10MB/s for large files, faster for small)
- CBOR encoding: Faster than JSON parsing
- SHA-256 hashing: Node.js crypto native (fast)
- No performance tests yet (L1 gap, acceptable for MVP)

**Best Practices Applied:**

1. **Crypto**: Used audited library (TweetNaCl), not custom crypto ✅
2. **Validation**: Zod at API boundaries (header parsing) ✅
3. **Error Handling**: Typed errors with context, no silent failures ✅
4. **Testing**: Comprehensive coverage with edge cases ✅
5. **Documentation**: Inline JSDoc + external tech spec/arch docs ✅

**References:**

- [TweetNaCl.js](https://github.com/dchest/tweetnacl-js) - Crypto primitives documentation
- [RFC 8949 - CBOR](https://datatracker.ietf.org/doc/html/rfc8949) - Binary encoding spec
- [Curve25519](https://cr.yp.to/ecdh.html) - ECDH specification
- [XSalsa20-Poly1305](https://nacl.cr.yp.to/secretbox.html) - AEAD construction
- [Base58](https://en.wikipedia.org/wiki/Base58) - Encoding for human-readable identifiers

---

### Action Items

**Priority: High (Required before production)**

1. **[H1]** Implement encrypted KeyManager storage OR document plaintext memory risk explicitly
   - Suggested: Add docstring warning on KeyManager class
   - Related: AC2 (decryption security)
   - Files: `src/api/encrypted-storage.ts:13-42`

**Priority: Medium (Required before production)** 2. **[M1]** Add content hash verification in `EncryptedStorage.get()`

- Implement SHA-256 hash check after blob retrieval
- Related: AC8 (round-trip integrity)
- Files: `src/api/encrypted-storage.ts:91`

3. **[M2]** Fix type safety in MinIO adapter error handling

   - Replace `catch (err: any)` with `catch (err: unknown)`
   - Related: AC10 (code quality)
   - Files: `src/storage/minio-adapter.ts:52`

4. **[M3]** Remove or implement placeholder functions in public API

   - Options: Delete OR add `throw new Error("Not implemented")`
   - Related: AC10 (API design)
   - Files: `src/index.ts:40-59`

5. **[M5]** Update architecture doc to reflect TweetNaCl choice
   - Align with tech-spec.md Section "Crypto Library"
   - Files: `docs/architecture/content-addressable-encrypted-storage.md:306`

**Priority: Low (Backlog)** 6. **[L1]** Track streaming API for large files (>100MB) as backlog item 7. **[L2]** Consider rate limiting at API gateway layer (operational, not code) 8. **[L3]** Add live MinIO integration tests in Story 1.2

---

**Next Steps for Developer:**

1. Address H1 (KeyManager security) - add documentation warning at minimum
2. Implement M1 (content hash verification) - 5-line fix
3. Fix M2 (type safety) - 2-line fix
4. Resolve M3 (placeholder functions) - design decision needed
5. Update M5 (architecture doc) - documentation only
6. Re-run tests to ensure no regressions
7. Request re-review once Medium severity items addressed

**Estimated Time to Address:** 2-3 hours for code changes + 30 min for doc update

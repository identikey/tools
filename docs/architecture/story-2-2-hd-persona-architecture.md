# Story 2.2: HD Persona Architecture - Decision Document

**Status:** Ready for Implementation  
**Date:** 2025-11-01  
**Epic:** CLI & Developer Examples (Epic 2)  
**Dependencies:** Story 2.1 (CLI Tool Foundation)  
**Related Specs:** `hd-key-hierarchy-ik-v1.md`, `dual-key-persona-architecture.md`

## Executive Summary

Story 2.2 implements hierarchical deterministic (HD) key derivation for personas, enabling users to back up all keys with a single BIP-39 mnemonic phrase while maintaining dual-key architecture (Ed25519 signing + X25519 encryption). Each persona has an independent seed, ensuring complete separation and enabling future persona portability.

## Core Architectural Decisions

### Decision 1: Persona Independence (Sibling Derivation Model)

**Decision:** Each persona has its own master seed; keys within a persona are derived as cryptographic siblings.

**Architecture:** Option B - Semantic Root with Sibling Derivation

```
Persona Seed (from BIP-39 mnemonic)
  ↓ (SLIP-0010 / HKDF-SHA512)
  ├─ Ed25519 identity key    (ik:v1:ed25519/0/identity/0)   [SEMANTIC ROOT]
  ├─ X25519 encryption key    (ik:v1:x25519/0/encryption/0)
  ├─ Solana wallet (future)   (ik:v1:solana/0/wallet/0)
  └─ Bitcoin wallet (future)  (ik:v1:bitcoin/0/wallet/0)
```

**Rationale:**

- **Security:** Keys are cryptographically independent; compromise of one doesn't affect others
- **Domain Separation:** Each curve type has its own derivation function (SLIP-0010 for Ed25519, HKDF for X25519)
- **Persona Portability:** Seeds can be detached and attached to different root keys (future feature)
- **No Metadata Leakage:** No cross-persona information in derivation paths
- **Standard Compliance:** Uses industry-standard derivation methods, auditable and testable

**Identity Root:** The Ed25519 key at `ik:v1:ed25519/0/identity/0` serves as the semantic identity root:

- Signs persona metadata and manifests
- Provides verifiable persona identity
- Referenced by other keys in ASCII armor headers (`RootFingerprint` field)
- Not a cryptographic parent (keys don't derive from it)

---

### Decision 2: HD Derivation Standards

**Ed25519 Keys:** SLIP-0010 (hardened-only)

- Industry standard for Ed25519 HD derivation
- Used by Trezor, Ledger for Ed25519 chains
- Properly handles Ed25519's non-linear keyspace
- Hardened-only prevents extended public key attacks

**X25519 Keys:** HKDF-SHA512 (hardened with domain separation)

- Cleaner for X25519 than forcing SLIP-0010
- Explicit domain separation via info strings
- Deterministic, auditable, curve-safe
- Compatible with future key types

**Mnemonic:** BIP-39 (12 words)

- 128-bit entropy (sufficient security)
- User-friendly, industry-standard
- Wide tool support for backup/recovery
- PBKDF2-HMAC-SHA512 (2048 iterations) to seed

---

### Decision 3: Path Structure

**Format:** `ik:v1:<curve>/<account>/<role>/<index>`

**Semantics:**

- `<curve>`: Key type (ed25519, x25519, solana, bitcoin, kyber, dilithium, etc.)
- `<account>`: Purpose grouping (0=primary, 1=delegated, 2=specialized, etc.)
- `<role>`: Key purpose within account (identity, encryption, signing, auth, session, etc.)
- `<index>`: Rotation counter (0, 1, 2...) - increments on key rotation

**Story 2.2 Paths (MVP):**

```
ik:v1:ed25519/0/identity/0     - Persona identity root (signing)
ik:v1:x25519/0/encryption/0    - Primary encryption key
```

**Future Paths (Deferred):**

```
ik:v1:ed25519/1/signing/0      - Delegated signing key
ik:v1:ed25519/2/auth/0         - Authentication key
ik:v1:x25519/1/session/0       - Session encryption key
ik:v1:solana/0/wallet/0        - Solana wallet
ik:v1:bitcoin/0/wallet/0       - Bitcoin wallet
ik:v1:kyber/0/pqc/0            - Post-quantum encryption (Kyber)
ik:v1:dilithium/0/pqc/0        - Post-quantum signing (Dilithium)
```

**Rationale:**

- Self-documenting paths (readable key purpose)
- Version-tagged for future evolution
- Flexible account/role structure for diverse key types
- No persona identifiers (maintains independence)

---

### Decision 4: Key Rotation Strategy

**Independent Rotation (Default):**

```
Current: ik:v1:x25519/0/encryption/0
Rotated: ik:v1:x25519/0/encryption/1
(Identity key stays at /0/identity/0)
```

**All-Keys Rotation (Seed Compromise):**

- Generate new seed (new mnemonic)
- Derive all keys at index 0 with new seed
- Mark old seed + all derived keys as revoked
- Maintain historical keys for decryption

**Story 2.2 Scope:** Defer rotation to future story; MVP only generates index 0 keys.

---

### Decision 5: Fingerprint Encoding

**Format:** Base58-encoded SHA-256 of public key (NO HEX)

**Short Form:** `<type>-<base58btc-10-bytes>`

- Ed25519: `ed1-E8ZfCRNXoR5uoS`
- X25519: `x1-A4QE2WewCwwh8r`

**Full Form:** Base58btc encoding of full 32 bytes

- Example: `E8ZfCRNXoR5uoS9vV4uYJkLm3nP7qR2sT8wX1zA5bC4`

**Usage:**

- **Internal storage:** Raw 32 bytes
- **All display/CLI:** Base58 (short or full)
- **ASCII armor headers:** Short form
- **JSON APIs:** Short form

**Rationale:**

- Type-safe (prefix distinguishes key types)
- Compact (shorter than hex)
- Standard (base58btc widely used in crypto)
- User-friendly (no confusion with hex)

---

### Decision 6: Storage Structure

```
~/.config/identikey/
  personas/
    default/
      seed.json          # Encrypted master seed
      persona.json       # Persona metadata
    work/
      seed.json
      persona.json
```

**seed.json (Encrypted):**

```json
{
  "version": "ik:v1",
  "encryptedSeed": "<base64>",
  "salt": "<base64-16-bytes>",
  "nonce": "<base64-24-bytes>",
  "kdf": "argon2id",
  "kdfParams": {
    "memory": 65536,
    "iterations": 3,
    "parallelism": 1
  }
}
```

**persona.json (Metadata):**

```json
{
  "version": "ik:v1",
  "name": "default",
  "created": "2025-11-01T00:00:00Z",
  "rootFingerprint": "ed1-E8ZfCRNXoR5uoS",
  "currentKeys": {
    "identity": {
      "path": "ik:v1:ed25519/0/identity/0",
      "fingerprint": "ed1-E8ZfCRNXoR5uoS",
      "created": "2025-11-01T00:00:00Z"
    },
    "encryption": {
      "path": "ik:v1:x25519/0/encryption/0",
      "fingerprint": "x1-A4QE2WewCwwh8r",
      "created": "2025-11-01T00:00:00Z"
    }
  },
  "revokedKeys": []
}
```

**Key Derivation:** On-demand from encrypted seed (keys never stored on disk).

---

### Decision 7: Implementation Libraries

| Library         | Version | Purpose                        | Rationale                          |
| --------------- | ------- | ------------------------------ | ---------------------------------- |
| `@scure/bip39`  | ^1.4.0  | BIP-39 mnemonic generation     | Modern, audited, TypeScript-first  |
| `@scure/bip32`  | ^1.5.0  | SLIP-0010 derivation (Ed25519) | Supports SLIP-0010 out of box      |
| `@noble/hashes` | ^1.5.0  | HKDF-SHA512, PBKDF2            | Zero-dependency, tree-shakeable    |
| `@noble/curves` | ^1.6.0  | Ed25519 + X25519 primitives    | Audited, maintained by Paul Miller |
| `tweetnacl`     | ^1.0.3  | Crypto operations (existing)   | Continue using for compatibility   |

**Hybrid Approach:**

- **HD Derivation:** @scure/@noble stack (TweetNaCl doesn't do HD/BIP-39)
- **Crypto Operations:** Keep TweetNaCl for `crypto_box` / `crypto_secretbox` (already working, hard to misuse)
- **Future Migration:** Plan transition to @noble/curves for consistency (defer to future story)

---

### Decision 8: ASCII Armor Extensions

**Add `RootFingerprint` header:**

```
----- BEGIN IDENTIKEY X25519 PRIVATE KEY -----
Version: ik:v1
KeyType: x25519
Path: ik:v1:x25519/0/encryption/0
Fingerprint: x1-A4QE2WewCwwh8r
RootFingerprint: ed1-E8ZfCRNXoR5uoS    ← NEW: references persona identity root
Algorithm: xsalsa20poly1305

<base64 encoded key data>
<CRC24 checksum>
----- END IDENTIKEY X25519 PRIVATE KEY -----
```

**Purpose:**

- Link keys to persona identity root
- Enable lookup of persona metadata
- Establish trust chains
- Verify signatures on persona manifests

---

## Implementation Requirements

### Must Implement (Story 2.2)

1. **BIP-39 Mnemonic Generation**

   - 12-word mnemonic (128-bit entropy)
   - Display once during keygen
   - Derive 64-byte seed via PBKDF2-HMAC-SHA512

2. **SLIP-0010 Derivation (Ed25519)**

   - Master key from seed: `HMAC-SHA512("ed25519 seed", seed)`
   - Hardened child derivation per path segment
   - Path: `ik:v1:ed25519/0/identity/0`

3. **HKDF-SHA512 Derivation (X25519)**

   - Salt: `SHA-256("ik:x25519:root")`
   - Info: `UTF-8("ik:v1:x25519/0/encryption/0")`
   - Output: 32 bytes → clamp to X25519 scalar
   - Path: `ik:v1:x25519/0/encryption/0`

4. **Fingerprint Computation**

   - `SHA-256(publicKey)` → 32 bytes
   - Full: Base58btc of 32 bytes
   - Short: `ed1-` or `x1-` + base58btc of first 10 bytes

5. **Seed Encryption**

   - KDF: Argon2id (memory=64MB, iterations=3, parallelism=1)
   - Cipher: XSalsa20-Poly1305 (TweetNaCl)
   - Store: `seed.json` with salt/nonce

6. **Persona Metadata**

   - Track current key paths and fingerprints
   - Store creation timestamps
   - Maintain revoked keys list (empty for MVP)

7. **CLI Command Updates**

   - `keygen`: Generate mnemonic, derive both keys, display mnemonic once
   - `encrypt/decrypt`: Use X25519 encryption key (path-based lookup)
   - `fingerprint`: Show both identity and encryption fingerprints
   - `info`: Display key paths and fingerprints

8. **ASCII Armor Updates**

   - Add `Path` header with full derivation path
   - Add `RootFingerprint` header referencing identity key
   - Update `Fingerprint` to use base58 short form

9. **Test Vectors**
   - Implement KATs from `hd-key-hierarchy-ik-v1.md`
   - Verify deterministic derivation
   - Cross-check with reference implementation

### Defer to Future Stories

- [ ] Key rotation (index > 0)
- [ ] Multiple accounts (account > 0)
- [ ] Additional key types (Solana, Bitcoin, Kyber, Dilithium)
- [ ] Multi-recipient envelopes
- [ ] All-keys rotation command
- [ ] Persona publishing/verification
- [ ] Device-specific sub-branches
- [ ] libsodium migration

---

## Integration with Existing Code

### Changes to Story 2-1 Components

**`src/keypair.ts`:**

- Keep existing functions for backward compatibility
- Add HD derivation functions:
  - `deriveEd25519(seed: Uint8Array, path: string): KeyPair`
  - `deriveX25519(seed: Uint8Array, path: string): KeyPair`
  - `generateMnemonic(): string`
  - `mnemonicToSeed(mnemonic: string): Uint8Array`

**`src/cli/utils/persona-manager.ts`:**

- Update to load seed instead of keypairs
- Derive keys on-demand from seed
- Track key paths in metadata
- Maintain rootFingerprint

**`src/cli/utils/key-encryption.ts`:**

- Add `encryptSeed()` / `decryptSeed()` functions
- Keep existing keypair encryption for migration period

**`src/cli/utils/armor.ts`:**

- Add `Path` and `RootFingerprint` headers
- Update fingerprint format to base58

**`src/cli/commands/keygen.ts`:**

- Generate BIP-39 mnemonic
- Derive both keys via HD paths
- Display mnemonic (with warning to save)
- Create seed.json + persona.json

**`src/header/fingerprint.ts`:**

- Update to output base58 (remove hex)
- Add short form generation with prefix

---

## Security Considerations

1. **Seed Protection:**

   - Encrypted at rest with Argon2id KDF
   - Passphrase required for all operations
   - Never log or display encrypted seed

2. **Domain Separation:**

   - Ed25519 and X25519 use different derivation methods
   - No runtime curve conversions
   - Prevents cryptographic cross-contamination

3. **Persona Isolation:**

   - Independent seeds per persona
   - No shared entropy or metadata
   - Enables per-persona threat modeling

4. **Mnemonic Display:**

   - Show once during keygen
   - Clear warning to save securely
   - Option to regenerate if lost (new persona)

5. **Key Rotation:**
   - Historical keys kept for decryption
   - Revocation tracked in metadata
   - All-keys rotation available on seed compromise

---

## Testing Strategy

### Unit Tests

1. **Derivation Determinism:**

   - Same seed + path → same keys
   - Verify against KAT vectors

2. **Path Parsing:**

   - Valid path formats accepted
   - Invalid formats rejected
   - Path component extraction

3. **Fingerprint Encoding:**

   - SHA-256 correctness
   - Base58 encoding/decoding
   - Short form with prefix

4. **Seed Encryption:**
   - Encrypt/decrypt round-trip
   - Wrong passphrase fails
   - Salt/nonce uniqueness

### Integration Tests

1. **Full Keygen Flow:**

   - Generate mnemonic → seed → keys
   - Encrypt seed with passphrase
   - Store seed.json + persona.json
   - Derive keys on-demand

2. **Encrypt/Decrypt with HD Keys:**

   - Encrypt with derived X25519 key
   - Decrypt with path-based lookup
   - Verify round-trip

3. **ASCII Armor:**
   - Armor keys with new headers
   - Dearmor and verify headers
   - RootFingerprint matches identity key

### Test Vectors (KATs)

Implement test cases from `hd-key-hierarchy-ik-v1.md`:

```typescript
test("HD derivation matches KAT vectors", () => {
  const seed = hexToBytes(
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
  );

  // Ed25519 identity key
  const edPath = "ik:v1:ed25519/0/identity/0";
  const edKey = deriveEd25519(seed, edPath);
  expect(bytesToBase58(edKey.publicKey)).toBe(
    "CXUz8d1QzLvFQMcRhzPg4VYDfWCXhBxJvBJxp7NZz8wN"
  );

  // X25519 encryption key
  const x25519Path = "ik:v1:x25519/0/encryption/0";
  const x25519Key = deriveX25519(seed, x25519Path);
  expect(bytesToBase58(x25519Key.publicKey)).toBe(
    "HwN2k8QvZxCxJhN4pM7TvR3kL5fY9gW2sB6xP1dA8zQy"
  );
});
```

---

## Migration Notes

**No Migration Required:** Pre-alpha development, no existing keys to migrate.

**Future Consideration:** If v1 (single-key) personas exist:

- Keep v1 format support in parallel
- Detect version on load
- Provide `identikey migrate` command to generate new HD persona

---

## Documentation Updates

1. **dual-key-persona-architecture.md** - ✅ Updated

   - Changed Curve25519 → X25519
   - Added HD key hierarchy details
   - Updated storage format
   - Added key generation flow

2. **hd-key-hierarchy-ik-v1.md** - ✅ Updated

   - Clarified persona independence
   - Removed hex fingerprints
   - Added path semantics
   - Updated test vectors to base58

3. **README.md** - TODO

   - Add HD key derivation to features
   - Update CLI examples with new paths
   - Document mnemonic backup importance

4. **ascii-armoring-spec.md** - TODO
   - Add `Path` and `RootFingerprint` headers
   - Update fingerprint format examples

---

## Open Questions (Resolved)

✅ **Account ↔ Persona mapping:** Personas are independent seeds, no mapping needed  
✅ **Role names:** `identity` for root, `encryption` for primary X25519  
✅ **Seed storage location:** `~/.config/identikey/personas/<name>/seed.json`  
✅ **Library stack:** Hybrid @scure/@noble for HD, TweetNaCl for crypto ops  
✅ **Fingerprint format:** Base58 only, no hex  
✅ **Migration strategy:** None needed (pre-alpha)

---

## References

- **HD Key Hierarchy Spec:** `docs/architecture/hd-key-hierarchy-ik-v1.md`
- **Dual-Key Architecture:** `docs/architecture/dual-key-persona-architecture.md`
- **ASCII Armor Spec:** `docs/architecture/ascii-armoring-spec.md`
- **Story 2-1:** `docs/stories/2-1-cli-tool-foundation.md`
- **Epic 2:** `docs/epics-cli-examples.md`

**Standards:**

- BIP-39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- SLIP-0010: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
- HKDF: RFC 5869
- Ed25519: RFC 8032
- X25519: RFC 7748

---

**Document Status:** ✅ READY FOR IMPLEMENTATION  
**Next Step:** Begin Story 2.2 development following this architecture  
**Generated:** 2025-11-01  
**Author:** Winston (Architect Agent)  
**For:** Master d0rje

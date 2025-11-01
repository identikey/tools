# Architecture Update: HKDF-SHA512 Uniform Derivation

**Date:** 2025-11-01  
**Decision:** Switch from SLIP-0010 to HKDF-SHA512 uniformly for all keys  
**Status:** ✅ Specs Updated  
**Impact:** Story 2.2 (not yet implemented)

---

## Summary

Changed HD key derivation method from dual-method approach (SLIP-0010 for Ed25519 + HKDF for X25519) to **uniform HKDF-SHA512 for all keys**.

## Rationale

1. **Hardware wallet compatibility already impossible** due to custom string paths (`ik:v1:ed25519/0/identity/0`)
2. **HKDF purpose-built for semantic paths** via info parameter
3. **Simpler implementation** - single method vs two different methods
4. **Better security** - simpler code = fewer bugs
5. **Future-proof** - works with any curve (secp256k1, Kyber, Dilithium, etc.)

## Key Insight

SLIP-0010 is designed for **numeric BIP-44 paths** like `m/44'/501'/0'/0'` used by hardware wallets.

Our architecture uses **semantic string paths** like `ik:v1:ed25519/0/identity/0`.

This makes hardware wallet compatibility **impossible regardless of derivation method**.

Since we can't use SLIP-0010's hardware wallet benefits anyway, we should use HKDF which is **designed** for custom string-based derivation.

## What Changed

### Documents Updated

1. **hd-key-hierarchy-ik-v1.md**

   - Replaced SLIP-0010 section with HKDF-SHA512 for Ed25519
   - Added uniform derivation explanation
   - Updated test vectors to use HKDF (placeholders, need generation)
   - Added reference implementation code

2. **story-2-2-hd-persona-architecture.md**

   - Updated Decision 2 (HD Derivation Standards)
   - Removed @scure/bip32 dependency (not needed)
   - Updated implementation requirements
   - Updated test vectors

3. **dual-key-persona-architecture.md**

   - Updated HD Key Hierarchy Details section
   - Added rationale for HKDF choice

4. **derivation-method-comparison.md** (NEW)
   - Comprehensive rubric comparing SLIP-0010 vs HKDF
   - Detailed analysis and scoring
   - Recommendation and rationale

### Technical Changes

**Before (Dual Method):**

```typescript
// Ed25519 - SLIP-0010
deriveEd25519(seed) {
  // Complex: master key, chain codes, parent tracking
  master = HMAC-SHA512("ed25519 seed", seed);
  // ... iterative hardened derivation ...
}

// X25519 - HKDF
deriveX25519(seed, path) {
  salt = SHA256("ik:x25519:root");
  return HKDF(seed, salt, path);
}
```

**After (Uniform HKDF):**

```typescript
// All keys - HKDF-SHA512
deriveKey(seed, path, curve) {
  salt = SHA256(`ik:${curve}:root`);
  info = Buffer.from(path, 'utf8');
  return HKDF_SHA512(seed, salt, info, 32);
}

// Convenience wrappers
deriveEd25519(seed, path) => deriveKey(seed, path, 'ed25519');
deriveX25519(seed, path) => deriveKey(seed, path, 'x25519');
```

### Dependencies Changed

**Removed:**

- ~~@scure/bip32~~ - No longer needed

**Using:**

- ✅ @noble/hashes - HKDF-SHA512, SHA-256, SHA-512
- ✅ @scure/bip39 - BIP-39 mnemonics
- ✅ @noble/curves - Ed25519/X25519 primitives (optional)
- ✅ TweetNaCl - crypto_box operations (keep existing)

## Implementation Impact

**Story 2.2 Status:** Not yet implemented ✅ No migration needed

**Code Changes Required:**

- Implement uniform `deriveKey()` function
- Remove SLIP-0010 code path
- Generate new test vectors with HKDF
- Update `scripts/generate-hd-kats.mjs`

**Benefits:**

- ~200 lines of code removed (no SLIP-0010 complexity)
- Single test suite instead of two
- Clearer audit trail (path string → key direct)
- Easier to extend to new curves

## Test Vectors

**Action Required:** Generate new KAT vectors using HKDF-SHA512

Script to implement: `scripts/generate-hd-kats.mjs`

```typescript
// Expected output format
Seed: 0x000102...1f

Ed25519 Path: ik:v1:ed25519/0/identity/0
  Salt: SHA256("ik:ed25519:root")
  Info: "ik:v1:ed25519/0/identity/0"
  sk_hex: [HKDF output]
  pk_base58: [public key]
  fingerprint_short: ed1-[base58]

X25519 Path: ik:v1:x25519/0/encryption/0
  Salt: SHA256("ik:x25519:root")
  Info: "ik:v1:x25519/0/encryption/0"
  sk_hex: [HKDF output]
  pk_base58: [public key]
  fingerprint_short: x1-[base58]
```

## Security Analysis

**Cryptographic Equivalence:**

- SLIP-0010 uses HMAC-SHA512 chain
- HKDF uses HMAC-SHA512 extract+expand
- Both are SHA-512 based, hardened-only
- HKDF arguably simpler (fewer intermediate values)

**Attack Surface:**

- SLIP-0010: More complex (chain codes, parent keys)
- HKDF: Simpler (direct derivation)
- **Winner:** HKDF (simpler = fewer bugs)

**Domain Separation:**

- SLIP-0010: Implicit via curve-specific constants
- HKDF: Explicit via salt + info parameters
- **Winner:** HKDF (more explicit, auditable)

## Future Extensions

Adding new key types becomes trivial:

```typescript
// Solana wallet
deriveKey(seed, "ik:v1:solana/0/wallet/0", "ed25519");

// Bitcoin wallet
deriveKey(seed, "ik:v1:bitcoin/0/wallet/0", "secp256k1");

// Post-quantum encryption
deriveKey(seed, "ik:v1:kyber/0/pqc/0", "kyber");

// Post-quantum signing
deriveKey(seed, "ik:v1:dilithium/0/pqc/0", "dilithium");
```

No need to define SLIP-0010 equivalents for each curve.

## References

- **Comparison Analysis:** `docs/architecture/derivation-method-comparison.md`
- **HD Spec:** `docs/architecture/hd-key-hierarchy-ik-v1.md`
- **Story 2.2:** `docs/architecture/story-2-2-hd-persona-architecture.md`
- **RFC 5869:** HKDF specification
- **SLIP-0010:** https://github.com/satoshilabs/slips/blob/master/slip-0010.md

---

**Decision Authority:** Master d0rje  
**Architect:** Winston  
**Status:** ✅ Complete - Ready for Story 2.2 Implementation

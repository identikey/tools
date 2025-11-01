# HD Key Derivation Method Comparison: SLIP-0010 vs HKDF-SHA512

**Context:** Evaluating whether to use SLIP-0010 for Ed25519 or switch to HKDF-SHA512 uniformly for all keys (Ed25519 + X25519)

**Key Consideration:** We use custom string-based paths (`ik:v1:ed25519/0/identity/0`) not BIP-44 numeric paths, which impacts hardware wallet compatibility.

---

## Decision Rubric

| **Criteria**             | **SLIP-0010 (Ed25519) + HKDF (X25519)**             | **HKDF-SHA512 (All Keys)**                        | **Winner**                                |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- | --- |
| **Security**             |                                                     |                                                   |                                           |     |
| Cryptographic Soundness  | ✅ Industry-proven for Ed25519 HD derivation        | ✅ RFC 5869 standard, proven KDF                  | **Tie** - Both cryptographically sound    |
| Domain Separation        | ✅ Implicit via curve-specific derivation           | ✅ **Explicit** via info parameter                | **HKDF** - More explicit, auditable       |
| Hardened-Only            | ✅ SLIP-0010 enforces hardened derivation           | ✅ HKDF naturally hardened (no pubkey derivation) | **Tie** - Both hardened-only              |
| Quantum Resistance       | ✅ Seed-centric (more resistant)                    | ✅ Seed-centric (more resistant)                  | **Tie** - Both protect seed chain         |
| Attack Surface           | ⚠️ More complex (chain codes, parent keys)          | ✅ Simpler (direct key derivation)                | **HKDF** - Simpler = fewer attack vectors |
| **Compatibility**        |                                                     |                                                   |                                           |     |
| Hardware Wallet Support  | ❌ **NO** - Custom paths incompatible               | ❌ **NO** - Custom paths incompatible             | **Tie** - Neither compatible              |
| BIP-44/SLIP-0044 Paths   | ⚠️ Could theoretically support `m/44'/...`          | ❌ Not designed for numeric BIP paths             | **SLIP-0010** (if we used BIP paths)      |
| Custom String Paths      | ⚠️ Non-standard use (bypasses chain codes)          | ✅ **Native** - Info param designed for this      | **HKDF** - Natural fit                    |
| Solana/Cardano Ecosystem | ✅ Solana uses SLIP-0010 variant                    | ⚠️ Less common in these ecosystems                | **SLIP-0010** (marginal)                  |
| **Implementation**       |                                                     |                                                   |                                           |     |
| Complexity               | ⚠️ More complex (chain codes, iterative derivation) | ✅ Simpler (one-step derivation)                  | **HKDF** - Much simpler                   |
| Library Support          | ✅ @scure/bip32 supports SLIP-0010                  | ✅ @noble/hashes has HKDF                         | **Tie** - Both well-supported             |
| Code Maintenance         | ⚠️ Two different derivation methods                 | ✅ **One** derivation method for all              | **HKDF** - Single codebase                |
| Testability              | ⚠️ More complex test vectors                        | ✅ Simpler test vectors                           | **HKDF** - Easier to verify               |
| Bug Surface              | ⚠️ More code paths (chain code bugs)                | ✅ Single implementation                          | **HKDF** - Less bug potential             |
| **Flexibility**          |                                                     |                                                   |                                           |     |
| String-Based Paths       | ⚠️ Requires numeric conversion                      | ✅ **Native** string support via info             | **HKDF** - Designed for this              |
| Multiple Curves          | ⚠️ Need curve-specific implementations              | ✅ Same method for all curves                     | **HKDF** - Uniform approach               |
| Custom Key Types         | ⚠️ Must adapt SLIP-0010 per curve                   | ✅ Just change info string                        | **HKDF** - Trivial to extend              |
| Future PQ Crypto         | ⚠️ SLIP-0010 not defined for Kyber/Dilithium        | ✅ Works with any key type                        | **HKDF** - Future-proof                   |
| **Interoperability**     |                                                     |                                                   |                                           |     |
| With Hardware Wallets    | ❌ **INCOMPATIBLE** - Custom paths                  | ❌ **INCOMPATIBLE** - Custom paths                | **N/A** - Neither works                   |
| With Existing Tools      | ⚠️ Only if they support SLIP-0010                   | ⚠️ Few tools expect HKDF for keys                 | **SLIP-0010** (marginal)                  |
| Cross-Implementation     | ⚠️ Must match SLIP-0010 exactly                     | ✅ Easier to document/replicate                   | **HKDF** - Simpler spec                   |
| Test Vector Sharing      | ✅ Can reference SLIP-0010 vectors                  | ⚠️ Must generate custom vectors                   | **SLIP-0010** (marginal)                  |
| **Auditability**         |                                                     |                                                   |                                           |     |
| Derivation Transparency  | ⚠️ Complex multi-step process                       | ✅ **Single-step**: HKDF(seed, salt, info)        | **HKDF** - Clearer audit trail            |
| Path → Key Mapping       | ⚠️ Requires understanding chain codes               | ✅ Direct: info string → key                      | **HKDF** - More obvious                   |
| Security Proof           | ✅ Proven in Ed25519 context                        | ✅ RFC 5869 proven for KDF use                    | **Tie** - Both proven                     |
| **Standards Compliance** |                                                     |                                                   |                                           |     |
| Industry Standard        | ✅ Standard for Ed25519 HD wallets                  | ⚠️ Non-standard for HD key derivation             | **SLIP-0010** - More recognized           |
| RFC Compliance           | ⚠️ Not an RFC (SatoshiLabs spec)                    | ✅ RFC 5869 (HKDF)                                | **HKDF** - Official standard              |
| **Use Case Fit**         |                                                     |                                                   |                                           |     |
| Persona Independence     | ✅ Works fine                                       | ✅ Works fine                                     | **Tie**                                   |
| Custom Derivation Paths  | ⚠️ Awkward (not what it's designed for)             | ✅ **Perfect fit** (info param)                   | **HKDF** - Designed for this              |
| Multiple Key Purposes    | ⚠️ Requires numeric account indices                 | ✅ Natural semantic role names                    | **HKDF** - Better semantics               |

---

## Summary Score

| **Aspect**           | **SLIP-0010 (Current)**            | **HKDF-SHA512 (Uniform)**           |
| -------------------- | ---------------------------------- | ----------------------------------- |
| Security             | 4.5/5                              | **5/5** (simpler = better)          |
| Compatibility        | 1/5 (HW wallets don't work anyway) | 1/5 (same)                          |
| Implementation       | 2.5/5 (complex, dual methods)      | **4.5/5** (simple, uniform)         |
| Flexibility          | 2.5/5                              | **5/5** (designed for custom paths) |
| Standards Compliance | 4/5                                | 3.5/5                               |
| **Overall**          | **14.5/25**                        | **19/25** ⭐                        |

---

## Key Insights

### ❌ Hardware Wallet Compatibility is Already Lost

**Critical Realization:** Our custom paths (`ik:v1:ed25519/0/identity/0`) are **incompatible** with hardware wallets regardless of derivation method.

**Why?**

- Hardware wallets expect **BIP-44 numeric paths**: `m/44'/501'/0'/0'` (Solana example)
- They don't support **custom string paths** or semantic roles
- They use **fixed** derivation standards (BIP-32/SLIP-0010) with **numeric** indices

**Conclusion:** SLIP-0010 gives us ZERO hardware wallet compatibility because our path format is fundamentally different.

### ✅ HKDF is Purpose-Built for Custom Derivation

**HKDF's info parameter** is explicitly designed for **domain separation with custom strings**:

```
HKDF-SHA512(
  seed,
  salt = SHA-256("ik:x25519:root"),
  info = "ik:v1:ed25519/0/identity/0"  ← Native string support
)
```

**SLIP-0010** requires numeric indices, so we'd have to:

1. Parse `ik:v1:ed25519/0/identity/0`
2. Convert to numeric path `[0, 0, 0]` (losing semantics)
3. Apply SLIP-0010 derivation
4. Map back to string path

This is **awkward** and defeats the purpose of semantic paths.

### 🔒 Security is Equivalent

Both methods:

- Are cryptographically sound
- Use hardened-only derivation
- Protect the seed chain
- Have been audited/proven

**HKDF is arguably simpler** (single-step vs multi-step), reducing bug potential.

### 🚀 HKDF Simplifies Future Extensions

Adding new key types:

**With SLIP-0010:**

```typescript
// Need curve-specific implementations
deriveEd25519(); // SLIP-0010 for Ed25519
deriveX25519(); // HKDF for X25519
deriveBitcoin(); // BIP-32 for secp256k1
deriveKyber(); // ??? (SLIP-0010 not defined)
```

**With HKDF:**

```typescript
// Uniform implementation
derive(path) {
  return HKDF(seed, salt, info=path);
}
```

### 📊 Implementation Cost

**SLIP-0010 (Current):**

- @scure/bip32 library (~10KB)
- Chain code tracking
- Parent key derivation logic
- Dual derivation methods (Ed25519 vs X25519)
- More complex test vectors

**HKDF (Uniform):**

- @noble/hashes library (already needed)
- Single derivation function
- No chain codes
- Works for all curves
- Simple test vectors

---

## Recommendation

### ⭐ Switch to HKDF-SHA512 for All Keys

**Rationale:**

1. **Hardware wallet compatibility is impossible anyway** due to custom paths
2. **HKDF is purpose-built** for custom string-based derivation (info param)
3. **Simpler implementation** = fewer bugs, easier audits
4. **Uniform approach** = one method for all curves (Ed25519, X25519, Solana, Bitcoin, PQ)
5. **Future-proof** for arbitrary key types (Kyber, Dilithium, etc.)
6. **Better semantic fit** = readable paths directly in derivation

### Proposed HKDF Scheme

```typescript
function deriveKey(
  seed: Uint8Array,
  path: string, // e.g., "ik:v1:ed25519/0/identity/0"
  curve: 'ed25519' | 'x25519' | 'secp256k1' | ...
): KeyPair {
  // Domain-separated salt per curve
  const salt = SHA256(`ik:${curve}:root`);

  // Full path as info parameter
  const info = Buffer.from(path, 'utf8');

  // Derive key material
  const keyMaterial = HKDF_SHA512(seed, salt, info, 32);

  // Curve-specific scalar clamping
  const sk = clampForCurve(keyMaterial, curve);
  const pk = computePublicKey(sk, curve);

  return { sk, pk };
}
```

**Benefits:**

- Single function for all keys
- Path string directly in derivation (perfect audit trail)
- Trivial to add new curves (just change salt)
- No chain codes or parent key tracking
- Clear domain separation via salt

### Migration from Current Spec

**Changes needed:**

1. **hd-key-hierarchy-ik-v1.md:**

   - Replace SLIP-0010 section with HKDF-SHA512 for Ed25519
   - Standardize on HKDF for all curves
   - Update test vectors

2. **story-2-2-hd-persona-architecture.md:**

   - Update "Decision 2: HD Derivation Standards"
   - Simplify to single derivation method
   - Note non-compatibility with hardware wallets

3. **Implementation:**
   - Remove @scure/bip32 dependency
   - Use @noble/hashes HKDF for everything
   - Simpler test suite

---

## Objections Considered

### "But SLIP-0010 is the standard for Ed25519"

**Response:** It's standard for **BIP-44 style numeric paths** on hardware wallets. We're using **custom semantic paths**, making SLIP-0010's design benefits irrelevant.

### "We might want hardware wallet support later"

**Response:** Would require:

1. Abandoning `ik:v1:...` paths
2. Switching to `m/44'/X'/...` numeric paths
3. Losing semantic clarity
4. Breaking all existing personas

**Not worth it.** If hardware wallet support is needed, create a separate derivation mode.

### "HKDF isn't proven for HD key derivation"

**Response:**

- HKDF is RFC 5869 standard, widely used in TLS, Signal, Noise Protocol
- Cryptographically equivalent to SLIP-0010's HMAC-SHA512 chain
- Actually **simpler** (fewer intermediate values to leak)
- Cardano uses HKDF variants for some derivations

---

## Open Questions

1. **Do we need interoperability with any existing SLIP-0010 implementations?**

   - Answer: No, we're defining our own persona system

2. **Are there regulatory/compliance reasons to use SLIP-0010?**

   - Answer: No known requirements

3. **Do we plan to support BIP-44 paths in the future?**
   - Answer: Unlikely given persona independence architecture

---

## Decision Criteria

**Choose SLIP-0010 if:**

- ✅ Need hardware wallet compatibility (but we don't)
- ✅ Must use BIP-44 numeric paths (but we don't)
- ✅ Interoperating with existing SLIP-0010 systems (but we aren't)

**Choose HKDF-SHA512 if:**

- ✅ Using custom string-based paths **(WE ARE)**
- ✅ Want simpler implementation **(WE DO)**
- ✅ Need uniform derivation for multiple curves **(WE DO)**
- ✅ Prioritize auditability **(WE DO)**

---

**Recommendation: Switch to HKDF-SHA512 uniformly for all keys.**

**Impact:** Low - Story 2.2 not yet implemented, no migration needed.

**Next Step:** Update specs to use HKDF-SHA512 for both Ed25519 and X25519.

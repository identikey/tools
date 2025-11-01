# Dual-Key Persona Architecture

**Status:** Planned (Post-Story 2-1)  
**Date:** 2025-11-01  
**Context:** Architectural requirement identified during Story 2-1 code review

## Overview

Personas must support dual-key architecture where each persona has two separate cryptographic keys for different purposes:

1. **Signing Key (Ed25519)** - Root/primary persona identity key
2. **Encryption Key (X25519)** - Attached key for encryption operations

## Rationale

### Why Ed25519 for Persona Root?

- **Persona Identity:** The persona root must be a **signing key** (Ed25519) because it needs to sign persona identity metadata that will be published
- **Future Use Cases:**
  - Signing persona manifests
  - Verifying persona authenticity
  - Establishing trust chains
  - Publishing to distributed identity systems

### Why X25519 for Encryption?

- **Encryption Operations:** Current IdentiKey encryption uses X25519 (Diffie-Hellman using Curve25519, via TweetNaCl `nacl.box`)
- **Separation of Concerns:** Signing and encryption should use different keys (cryptographic best practice)
- **Key Specialization:** Each key type optimized for its purpose
- **Standard Terminology:** X25519 refers to the DH function, Curve25519 refers to the underlying elliptic curve

## Current State (Story 2-1)

### What Works Now

- ✅ Single Curve25519 keypair per persona
- ✅ Encryption/decryption operations functional
- ✅ Key management and persona switching
- ✅ ASCII armoring
- ✅ Passphrase encryption

### Limitations

- ❌ No signing capability (personas cannot sign identity metadata)
- ❌ Cannot publish persona identity (requires signing key)
- ❌ Single key does dual-duty (not best practice)
- ❌ No hierarchical deterministic (HD) key derivation

## Proposed Architecture

### Hierarchical Deterministic (HD) Key Derivation

Personas use HD key derivation from a master seed (BIP-39 mnemonic). Each persona has an independent seed, ensuring complete separation between personas.

**Architecture:** Sibling derivation (Option B)

- All keys derived independently from same seed
- Root Ed25519 key is semantic identity root (not cryptographic parent)
- Domain separation via distinct derivation paths

**Derivation Paths:**

```
ik:v1:ed25519/0/identity/0    - Persona identity root (signing)
ik:v1:x25519/0/encryption/0   - Primary encryption key
```

**Key Properties:**

- Personas are independent seeds (no cross-persona metadata leakage)
- Keys can be rotated independently (increment index)
- ASCII armored keys reference root fingerprint
- Root key signs persona identity metadata

### Storage Format (v2)

**Seed Storage:** `~/.config/identikey/personas/<name>/seed.json`

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

**Persona Metadata:** `~/.config/identikey/personas/<name>/persona.json`

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

### Key Generation Flow (HD)

```typescript
// 1. Generate or import BIP-39 mnemonic (12 words)
const mnemonic = generateMnemonic(128); // 12 words = 128 bit entropy
const seed = mnemonicToSeed(mnemonic); // PBKDF2 → 64 bytes

// 2. Derive identity key (Ed25519 via SLIP-0010)
const identityPath = "ik:v1:ed25519/0/identity/0";
const identityKeypair = deriveEd25519(seed, identityPath);
const identityFingerprint = computeFingerprint(identityKeypair.publicKey); // Base58

// 3. Derive encryption key (X25519 via HKDF-SHA512)
const encryptionPath = "ik:v1:x25519/0/encryption/0";
const encryptionKeypair = deriveX25519(seed, encryptionPath);
const encryptionFingerprint = computeFingerprint(encryptionKeypair.publicKey); // Base58

// 4. Encrypt seed with passphrase (Argon2id KDF)
const encryptedSeed = encryptSeed(seed, passphrase);
```

### Command Behavior Changes

#### `keygen`

- Generate BIP-39 mnemonic (12 words)
- Derive **both** Ed25519 identity and X25519 encryption keys via HD paths
- Display mnemonic (one-time), both fingerprints
- Use identity fingerprint as primary persona identifier

#### `encrypt` / `decrypt`

- Use X25519 encryption key derived at `ik:v1:x25519/0/encryption/0`
- No visible change to user

#### `sign` / `verify` (new commands)

- Use Ed25519 signing key
- Sign persona metadata, messages, files

#### `persona publish` (future)

- Sign persona identity with Ed25519 key
- Publish to distributed identity system

## Migration Strategy

### Backward Compatibility

**Option 1: Hard Break (Recommended)**

- Version 2 key format incompatible with v1
- Users must regenerate keys with `keygen`
- Clear migration guide
- Justification: Pre-1.0, small user base

**Option 2: Soft Migration**

- Support both v1 (single key) and v2 (dual key) formats
- Auto-upgrade prompt when using v1 keys
- Requires maintaining legacy code paths

### Migration Steps

1. **Story 2.x: Implement Dual-Key Architecture**

   - Update key-encryption utilities
   - Update keygen command
   - Update all commands to use correct key type
   - Update tests
   - Update documentation

2. **Story 2.y: Add Signing Commands**

   - Implement `sign` command
   - Implement `verify` command
   - Add signing to persona metadata

3. **Story 3.x: Persona Publishing**
   - Design persona manifest format
   - Implement `persona publish` command
   - Implement identity verification

## HD Key Hierarchy Details

See: `docs/architecture/hd-key-hierarchy-ik-v1.md`

**Key Points:**

- Ed25519: SLIP-0010 hardened-only derivation
- X25519: HKDF-SHA512 hardened derivation with domain separation
- Personas are independent seeds (no cross-persona paths)
- Path format: `ik:v1:<curve>/<account>/<role>/<index>`
- Fingerprints: Base58-encoded SHA-256 of public key
- Short form: `ed1-` or `x1-` prefix + base58btc of first 10 bytes

## Implementation Checklist

### Phase 1: Core Dual-Key Support

- [ ] Update `EncryptedKeyFile` interface to v2 format
- [ ] Implement `encryptDualKeys()` function
- [ ] Implement `decryptSigningKey()` function
- [ ] Implement `decryptEncryptionKey()` function
- [ ] Add `generateKeyPair()` - Ed25519 signing
- [ ] Add `generateEncryptionKeyPair()` - Curve25519 encryption
- [ ] Update keygen command to generate both keys
- [ ] Update encrypt/decrypt to use encryption key
- [ ] Update fingerprint command to show both keys
- [ ] Update persona config to track both fingerprints
- [ ] Write migration tests
- [ ] Update all unit tests
- [ ] Update all integration tests
- [ ] Update documentation

### Phase 2: Signing Commands

- [ ] Implement `sign` command
- [ ] Implement `verify` command
- [ ] Add signature format specification
- [ ] Add signature tests
- [ ] Update documentation

### Phase 3: Persona Publishing

- [ ] Design persona manifest format
- [ ] Implement manifest signing
- [ ] Implement `persona publish` command
- [ ] Implement verification workflow
- [ ] Add publishing tests
- [ ] Update documentation

## References

- **Current Implementation:** Story 2-1 (Curve25519-only)
- **TweetNaCl Documentation:** https://tweetnacl.js.org/
- **Ed25519 Spec:** RFC 8032
- **Curve25519 Spec:** RFC 7748
- **Key Separation:** NIST SP 800-57 Part 1
- **HD Keys:** BIP-32, BIP-44

## Notes

- This is a **breaking change** requiring key regeneration
- Consider timing with other breaking changes (HD keys, etc.)
- Document migration path clearly for early adopters
- Ensure test coverage for both v1→v2 migration and fresh v2 generation

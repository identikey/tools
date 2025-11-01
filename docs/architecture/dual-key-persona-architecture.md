# Dual-Key Persona Architecture

**Status:** Planned (Post-Story 2-1)  
**Date:** 2025-11-01  
**Context:** Architectural requirement identified during Story 2-1 code review

## Overview

Personas must support dual-key architecture where each persona has two separate cryptographic keys for different purposes:

1. **Signing Key (Ed25519)** - Root/primary persona identity key
2. **Encryption Key (Curve25519)** - Attached key for encryption operations

## Rationale

### Why Ed25519 for Persona Root?

- **Persona Identity:** The persona root must be a **signing key** (Ed25519) because it needs to sign persona identity metadata that will be published
- **Future Use Cases:**
  - Signing persona manifests
  - Verifying persona authenticity
  - Establishing trust chains
  - Publishing to distributed identity systems

### Why Curve25519 for Encryption?

- **Encryption Operations:** Current IdentiKey encryption uses Curve25519 (via TweetNaCl `nacl.box`)
- **Separation of Concerns:** Signing and encryption should use different keys (cryptographic best practice)
- **Key Specialization:** Each key type optimized for its purpose

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

## Proposed Architecture

### Key File Format (v2)

```json
{
  "version": 2,

  "signing": {
    "publicKey": "<base58>",
    "privateKey": "<encrypted-base64>",
    "fingerprint": "<base58-sha256>",
    "salt": "<base64-16-bytes>",
    "nonce": "<base64-24-bytes>",
    "algorithm": "Ed25519"
  },

  "encryption": {
    "publicKey": "<base58>",
    "privateKey": "<encrypted-base64>",
    "fingerprint": "<base58-sha256>",
    "salt": "<base64-16-bytes>",
    "nonce": "<base64-24-bytes>",
    "algorithm": "Curve25519"
  },

  "metadata": {
    "created": "2025-11-01T00:00:00Z",
    "personaName": "default",
    "primaryFingerprint": "<signing-fingerprint>"
  }
}
```

### Key Generation Flow

```typescript
// 1. Generate signing keypair (Ed25519 - persona root)
const signingKeypair = nacl.sign.keyPair();
const signingFingerprint = computeFingerprint(signingKeypair.publicKey);

// 2. Generate encryption keypair (Curve25519 - for encryption ops)
const encryptionKeypair = nacl.box.keyPair();
const encryptionFingerprint = computeFingerprint(encryptionKeypair.publicKey);

// 3. Encrypt both with passphrase (separate salts/nonces)
const keyFile = encryptDualKeys(signingKeypair, encryptionKeypair, passphrase);
```

### Command Behavior Changes

#### `keygen`

- Generate **both** Ed25519 and Curve25519 keypairs
- Display both fingerprints
- Use signing fingerprint as primary persona identifier

#### `encrypt` / `decrypt`

- Continue using Curve25519 encryption key
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

## HD Key Generation (Future)

Beyond dual-key, support hierarchical deterministic (HD) key generation:

- **Master Seed:** Single seed generates all persona keys
- **Key Derivation:** BIP-32/BIP-44 style paths
- **Multiple Personas:** Derive signing + encryption keys per persona
- **Backup:** Single seed backs up all keys

**Example Path Structure:**

```
m/44'/0'/0'/0/0  - Persona 0 signing key
m/44'/0'/0'/1/0  - Persona 0 encryption key
m/44'/0'/1'/0/0  - Persona 1 signing key
m/44'/0'/1'/1/0  - Persona 1 encryption key
```

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

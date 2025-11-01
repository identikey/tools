# Architecture Documentation

This directory contains architecture specifications and decision records for the IdentiKey Tools project.

## Current Architecture Documents

### Core Specifications

1. **[hd-key-hierarchy-ik-v1.md](./hd-key-hierarchy-ik-v1.md)** - HD Key Derivation Specification

   - Defines uniform HKDF-SHA512 derivation for all keys
   - Path format: `ik:v1:<curve>/<account>/<role>/<index>`
   - Domain separation via curve-specific salts
   - Test vectors and reference implementation

2. **[dual-key-persona-architecture.md](./dual-key-persona-architecture.md)** - Dual-Key Persona System

   - Ed25519 signing key (persona identity root)
   - X25519 encryption key (data operations)
   - Persona independence and portability
   - Storage format and key management

3. **[story-2-2-hd-persona-architecture.md](./story-2-2-hd-persona-architecture.md)** - Story 2.2 Implementation Guide
   - Comprehensive decision document for Story 2.2
   - Implementation requirements and scope
   - Integration with existing code
   - Testing strategy and security considerations

### Decision Records

4. **[derivation-method-comparison.md](./derivation-method-comparison.md)** - SLIP-0010 vs HKDF Analysis

   - Comprehensive rubric comparing derivation methods
   - Rationale for choosing HKDF-SHA512 uniformly
   - Security, implementation, and compatibility analysis

5. **[ARCHITECTURE-UPDATE-2025-11-01.md](./ARCHITECTURE-UPDATE-2025-11-01.md)** - Latest Architecture Change
   - Switch from SLIP-0010 to HKDF-SHA512 uniform derivation
   - Impact analysis and implementation notes
   - Test vector generation requirements

### Other Specifications

6. **[ascii-armoring-spec.md](./ascii-armoring-spec.md)** - ASCII Armor Format

   - Key and message armoring format
   - Base58 encoding with CRC24 checksums
   - Header fields and delimiters

7. **Security Validation Reports** (in this directory)
   - Performance baselines
   - Security validation tests
   - Validation reports for various components

## Architecture Decision Summary

### Key Decisions (Story 2.2)

| Decision          | Choice                                   | Rationale                                          |
| ----------------- | ---------------------------------------- | -------------------------------------------------- |
| **Persona Model** | Independent seeds, sibling derivation    | Complete persona separation, portability           |
| **HD Derivation** | HKDF-SHA512 uniform (all keys)           | Native string path support, simpler implementation |
| **Path Format**   | `ik:v1:<curve>/<account>/<role>/<index>` | Self-documenting, version-tagged, semantic         |
| **Mnemonic**      | BIP-39 (12 words)                        | 128-bit entropy, user-friendly                     |
| **Fingerprints**  | Base58 only (ed1-/x1- prefix)            | Type-safe, compact, no hex                         |
| **Storage**       | seed.json (encrypted) + persona.json     | Seed-based derivation, on-demand keys              |

### Why HKDF Instead of SLIP-0010?

1. **Hardware wallet compatibility impossible** - Custom string paths incompatible
2. **HKDF purpose-built** - Info parameter designed for semantic paths
3. **Simpler implementation** - No chain codes, single method for all curves
4. **Future-proof** - Works with any curve (secp256k1, Kyber, Dilithium)

## Path Format Examples

```
ik:v1:ed25519/0/identity/0      - Persona identity root (signing)
ik:v1:x25519/0/encryption/0     - Primary encryption key
ik:v1:ed25519/1/signing/0       - Delegated signing key (future)
ik:v1:solana/0/wallet/0         - Solana wallet key (future)
ik:v1:kyber/0/pqc/0             - Post-quantum encryption (future)
```

## Implementation Notes

### Story 2.2 MVP Scope

**Implement:**

- BIP-39 mnemonic (12 words) generation
- HKDF-SHA512 derivation for Ed25519 + X25519
- Base58 fingerprints with ed1-/x1- prefixes
- Seed encryption with Argon2id
- Persona metadata tracking
- ASCII armor extensions (Path + RootFingerprint headers)

**Defer:**

- Key rotation (index > 0)
- Additional key types (Solana, Bitcoin, PQ)
- Multi-recipient envelopes
- Persona publishing

### Dependencies

| Library         | Version | Purpose                               |
| --------------- | ------- | ------------------------------------- |
| `@scure/bip39`  | ^1.4.0  | BIP-39 mnemonics                      |
| `@noble/hashes` | ^1.5.0  | HKDF-SHA512, SHA-256, SHA-512         |
| `@noble/curves` | ^1.6.0  | Ed25519 + X25519 primitives           |
| `tweetnacl`     | ^1.0.3  | crypto_box operations (keep existing) |

**Removed:** ~~@scure/bip32~~ - Not needed with HKDF approach

## Test Vectors

Test vectors need to be generated using HKDF-SHA512 method.

Script: `scripts/generate-hd-kats.mjs`

See `hd-key-hierarchy-ik-v1.md` for reference implementation and expected output format.

## Architecture Timeline

- **2025-10-28:** Initial dual-key architecture proposal
- **2025-10-31:** BMAD rules installed, workflow system configured
- **2025-11-01:** Architecture workflow completed
  - Reviewed Story 2.2 requirements
  - Analyzed SLIP-0010 vs HKDF trade-offs
  - **Decision:** Switch to HKDF-SHA512 uniformly
  - Updated all specs and decision documents
  - Ready for Story 2.2 implementation

## Next Steps

1. **Implement Story 2.2** following `story-2-2-hd-persona-architecture.md`
2. **Generate test vectors** via `scripts/generate-hd-kats.mjs`
3. **Validate KATs** against spec in `hd-key-hierarchy-ik-v1.md`
4. **Update CLI commands** to use HD derivation

## References

- **HD Key Spec:** RFC 5869 (HKDF)
- **Mnemonic Spec:** BIP-39
- **Curves:** Ed25519 (RFC 8032), X25519 (RFC 7748)
- **Project:** IdentiKey Tools

---

_Last Updated: 2025-11-01_  
_Architect: Winston_  
_For: Master d0rje_

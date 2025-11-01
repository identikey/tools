# Story 2.2: HD Persona Architecture with Dual Keys

Status: ready-for-dev

## Story

As a **developer integrating IdentiKey Tools**,
I want **HD key derivation for personas with dual keys (Ed25519 signing + X25519 encryption) backed by BIP-39 mnemonics**,
so that **I can back up all keys with a single 12-word phrase, maintain separation between signing and encryption operations, and enable future features like persona publishing and key rotation**.

## Acceptance Criteria

1. **BIP-39 Mnemonic Generation:** `identikey keygen` generates 12-word BIP-39 mnemonic (128-bit entropy), displays once with warning to save securely
2. **Dual-Key Derivation:** Each persona has Ed25519 identity key (`ik:v1:ed25519/0/identity/0`) + X25519 encryption key (`ik:v1:x25519/0/encryption/0`)
3. **SLIP-0010 for Ed25519:** Identity keys derived via SLIP-0010 hardened-only derivation
4. **HKDF for X25519:** Encryption keys derived via HKDF-SHA512 with domain separation
5. **Base58 Fingerprints:** All fingerprints displayed as Base58 (full or short form with prefix: `ed1-`, `x1-`)
6. **Seed Encryption:** Master seed encrypted with Argon2id (64MB memory, 3 iterations) and stored in `seed.json`
7. **Persona Metadata:** `persona.json` tracks current key paths, fingerprints, creation timestamps, root fingerprint
8. **Keygen Updated:** `identikey keygen --persona <name>` creates seed.json + persona.json with dual keys
9. **Encrypt/Decrypt Use X25519:** Commands automatically use encryption key at path `ik:v1:x25519/0/encryption/0`
10. **Fingerprint Command:** `identikey fingerprint` shows both identity and encryption fingerprints with types
11. **ASCII Armor Extensions:** Armor headers include `Path` and `RootFingerprint` fields
12. **Test Vectors Pass:** Implement and pass KAT vectors from `hd-key-hierarchy-ik-v1.md` spec
13. **Backward Compatibility:** Old v1 (single-key) personas gracefully detected as incompatible with clear error message
14. **All Tests Pass:** Unit tests for derivation, integration tests for CLI workflows, KAT tests for spec compliance

[Source: docs/architecture/story-2-2-hd-persona-architecture.md#Implementation-Requirements]

## Tasks / Subtasks

### Phase 1: HD Derivation Core Infrastructure (AC: 1, 3, 4)

- [ ] Task 1.1: Install HD Key Dependencies (AC: 1, 3, 4)

  - [ ] Add `@scure/bip39@^1.4.0` to package.json
  - [ ] Add `@scure/bip32@^1.5.0` to package.json (SLIP-0010 support)
  - [ ] Add `@noble/hashes@^1.5.0` to package.json (HKDF, PBKDF2)
  - [ ] Add `@noble/curves@^1.6.0` to package.json (Ed25519 + X25519 primitives)
  - [ ] Run `bun install` and verify all dependencies resolve
  - [ ] Update package-lock if needed

- [ ] Task 1.2: Implement BIP-39 Mnemonic Utilities (AC: 1)

  - [ ] Create `src/hd/mnemonic.ts` module
  - [ ] Implement `generateMnemonic(): string` (12 words, 128-bit entropy)
  - [ ] Implement `mnemonicToSeed(mnemonic: string): Uint8Array` (PBKDF2-HMAC-SHA512, 2048 iterations)
  - [ ] Implement `validateMnemonic(mnemonic: string): boolean`
  - [ ] Add entropy source validation (use crypto.randomBytes)
  - [ ] Unit tests: mnemonic generation, validation, deterministic seed derivation

- [ ] Task 1.3: Implement SLIP-0010 Ed25519 Derivation (AC: 3)

  - [ ] Create `src/hd/derive-ed25519.ts` module
  - [ ] Implement `deriveEd25519Master(seed: Uint8Array): {sk, pk, chainCode}`
    - Use HMAC-SHA512(key="ed25519 seed", seed)
  - [ ] Implement `deriveEd25519Child(parent, index): {sk, pk, chainCode}`
    - Hardened-only: HMAC-SHA512(chainCode, 0x00 || sk || ser32(index + 2^31))
  - [ ] Implement `deriveEd25519Path(seed, path): KeyPair`
    - Parse path (e.g., "ik:v1:ed25519/0/identity/0")
    - Iterate segments, apply hardened derivation
  - [ ] Clamp Ed25519 private key per RFC 8032 rules
  - [ ] Compute Ed25519 public key via basepoint multiplication
  - [ ] Unit tests: master derivation, child derivation, path parsing, determinism

- [ ] Task 1.4: Implement HKDF X25519 Derivation (AC: 4)
  - [ ] Create `src/hd/derive-x25519.ts` module
  - [ ] Implement `deriveX25519(seed, path): KeyPair`
    - Salt: SHA-256(UTF-8("ik:x25519:root"))
    - Info: UTF-8(path) (e.g., "ik:v1:x25519/0/encryption/0")
    - Extract+Expand: HKDF-SHA512(seed, salt, info, 32 bytes)
  - [ ] Clamp X25519 scalar: `sk[0] &= 248; sk[31] &= 127; sk[31] |= 64`
  - [ ] Compute X25519 public key via scalar multiplication (base point)
  - [ ] Unit tests: derivation determinism, salt computation, info encoding, clamping

### Phase 2: Fingerprint and Path Utilities (AC: 5, 12)

- [ ] Task 2.1: Update Fingerprint Module for Base58 (AC: 5)

  - [ ] Update `src/header/fingerprint.ts` to remove hex output
  - [ ] Implement `computeFingerprint(pubkey: Uint8Array): Uint8Array` (SHA-256, returns 32 bytes)
  - [ ] Implement `fingerprintToBase58Full(fp: Uint8Array): string` (base58btc encoding of 32 bytes)
  - [ ] Implement `fingerprintToBase58Short(fp: Uint8Array, type: 'ed25519' | 'x25519'): string`
    - Ed25519: `ed1-` + base58btc(first 10 bytes)
    - X25519: `x1-` + base58btc(first 10 bytes)
  - [ ] Add `fingerprintFromBase58(short: string): {type, bytes}` decoder
  - [ ] Unit tests: SHA-256 correctness, base58 encoding/decoding, short form with prefix, roundtrip

- [ ] Task 2.2: Implement Path Parser and Validator (AC: 2, 12)
  - [ ] Create `src/hd/path.ts` module
  - [ ] Implement `parsePath(path: string): {curve, account, role, index}`
    - Regex: `^ik:v1:(ed25519|x25519)/(\d+)/(\w+)/(\d+)$`
  - [ ] Implement `validatePath(path: string): boolean`
  - [ ] Implement `buildPath(curve, account, role, index): string`
  - [ ] Define path constants: `IDENTITY_PATH`, `ENCRYPTION_PATH`
    - `ik:v1:ed25519/0/identity/0`
    - `ik:v1:x25519/0/encryption/0`
  - [ ] Unit tests: valid path parsing, invalid format rejection, path construction

### Phase 3: Seed Encryption and Storage (AC: 6, 7)

- [ ] Task 3.1: Implement Seed Encryption Utility (AC: 6)

  - [ ] Create `src/hd/seed-encryption.ts` module
  - [ ] Implement `encryptSeed(seed, passphrase): EncryptedSeed`
    - KDF: Argon2id (memory=65536 KB, iterations=3, parallelism=1)
    - Generate salt (16 bytes), nonce (24 bytes)
    - Cipher: XSalsa20-Poly1305 (TweetNaCl secretbox)
    - Return: {encryptedSeed, salt, nonce, kdf, kdfParams}
  - [ ] Implement `decryptSeed(encrypted, passphrase): Uint8Array`
    - Derive key via Argon2id with stored salt/params
    - Decrypt with TweetNaCl secretbox
  - [ ] Add passphrase validation (minimum 8 characters)
  - [ ] Unit tests: encrypt/decrypt roundtrip, wrong passphrase fails, salt uniqueness

- [ ] Task 3.2: Implement Seed and Persona Storage (AC: 6, 7)
  - [ ] Create `src/hd/storage.ts` module
  - [ ] Define `SeedFile` interface (version, encryptedSeed, salt, nonce, kdf, kdfParams)
  - [ ] Define `PersonaMetadata` interface (version, name, created, rootFingerprint, currentKeys, revokedKeys)
  - [ ] Implement `saveSeed(personaName, encryptedSeed): void`
    - Path: `~/.config/identikey/personas/<name>/seed.json`
    - Write with atomic file operation (temp + rename)
  - [ ] Implement `loadSeed(personaName): EncryptedSeed`
  - [ ] Implement `savePersonaMetadata(personaName, metadata): void`
    - Path: `~/.config/identikey/personas/<name>/persona.json`
  - [ ] Implement `loadPersonaMetadata(personaName): PersonaMetadata`
  - [ ] Unit tests: save/load roundtrip, atomic writes, directory creation

### Phase 4: Update Keygen Command (AC: 8)

- [ ] Task 4.1: Refactor Keygen for HD Dual Keys (AC: 1, 2, 8)

  - [ ] Update `src/cli/commands/keygen.ts` to use HD derivation
  - [ ] Generate BIP-39 mnemonic (12 words) via `generateMnemonic()`
  - [ ] Display mnemonic with prominent warning:

    ```
    🔐 IMPORTANT: Save your recovery phrase securely!
    Write down these 12 words in order. This is the ONLY way to recover your keys.

    word1 word2 word3 ... word12

    ⚠️  This phrase will NOT be shown again!
    ```

  - [ ] Convert mnemonic to seed via `mnemonicToSeed()`
  - [ ] Derive Ed25519 identity key: `deriveEd25519Path(seed, "ik:v1:ed25519/0/identity/0")`
  - [ ] Derive X25519 encryption key: `deriveX25519(seed, "ik:v1:x25519/0/encryption/0")`
  - [ ] Compute fingerprints for both keys (base58 short form)
  - [ ] Prompt user for passphrase (twice, must match)
  - [ ] Encrypt seed with `encryptSeed(seed, passphrase)`
  - [ ] Save seed.json and persona.json via storage module
  - [ ] Display success summary:
    ```
    ✅ Persona created: <name>
    📍 Location: ~/.config/identikey/personas/<name>/
    🔑 Identity Key (Ed25519):  ed1-<fingerprint>
    🔐 Encryption Key (X25519): x1-<fingerprint>
    ```
  - [ ] Integration tests: keygen creates seed.json + persona.json, mnemonic displayed once

### Phase 5: Update PersonaManager for HD Keys (AC: 8, 9)

- [ ] Task 5.1: Refactor PersonaManager for Seed-Based Derivation (AC: 7, 9)

  - [ ] Update `src/cli/utils/persona-manager.ts`
  - [ ] Change persona loading: load seed.json + persona.json (not keypairs)
  - [ ] Implement `derivePerson aKeys(personaName, passphrase): {identityKey, encryptionKey}`
    - Load seed.json, decrypt with passphrase
    - Load persona.json to get key paths
    - Derive keys on-demand via path
  - [ ] Implement `getIdentityKey(personaName, passphrase): KeyPair`
  - [ ] Implement `getEncryptionKey(personaName, passphrase): KeyPair`
  - [ ] Implement `getPersonaMetadata(personaName): PersonaMetadata`
  - [ ] Update config.json to track rootFingerprint (Ed25519) per persona
  - [ ] Unit tests: load persona, derive keys, path lookup, passphrase caching (optional)

- [ ] Task 5.2: Add Backward Compatibility Check (AC: 13)

  - [ ] Detect v1 (old single-key) persona format: check for `id.json` file
  - [ ] If v1 detected, show clear error:

    ```
    ❌ Persona "<name>" uses old format (v1) incompatible with HD keys.

    To migrate:
    1. Back up your old keys
    2. Run `identikey keygen --persona <name>` to regenerate with HD support
    3. Re-encrypt any data with new keys

    Note: This is a breaking change required for HD key hierarchy support.
    ```

  - [ ] Unit tests: detect v1 format, show migration message

### Phase 6: Update Encrypt/Decrypt Commands (AC: 9)

- [ ] Task 6.1: Update Encrypt Command for X25519 Path Lookup (AC: 9)

  - [ ] Update `src/cli/commands/encrypt.ts`
  - [ ] When using persona (no --key flag):
    - Call `PersonaManager.getEncryptionKey(activePersona, passphrase)`
    - Use derived X25519 key at path `ik:v1:x25519/0/encryption/0`
  - [ ] Keep explicit --key flag behavior unchanged (for non-persona keys)
  - [ ] Integration tests: encrypt with HD persona, verify uses X25519 key

- [ ] Task 6.2: Update Decrypt Command for X25519 Path Lookup (AC: 9)
  - [ ] Update `src/cli/commands/decrypt.ts`
  - [ ] When using persona (no --key flag):
    - Prompt for passphrase
    - Call `PersonaManager.getEncryptionKey(activePersona, passphrase)`
    - Use derived X25519 key for decryption
  - [ ] Keep explicit --key flag behavior unchanged
  - [ ] Integration tests: encrypt/decrypt roundtrip with HD persona

### Phase 7: Update Fingerprint Command (AC: 10)

- [ ] Task 7.1: Update Fingerprint Command for Dual Keys (AC: 10)
  - [ ] Update `src/cli/commands/fingerprint.ts`
  - [ ] When using persona (no --key flag):
    - Load persona.json metadata (no passphrase needed)
    - Display both fingerprints:
      ```
      Persona: default
      🔑 Identity Key (Ed25519):  ed1-E8ZfCRNXoR5uoS
      🔐 Encryption Key (X25519): x1-A4QE2WewCwwh8r
      ```
  - [ ] If --json flag:
    ```json
    {
      "persona": "default",
      "identityKey": {
        "type": "ed25519",
        "fingerprint": "ed1-E8ZfCRNXoR5uoS",
        "path": "ik:v1:ed25519/0/identity/0"
      },
      "encryptionKey": {
        "type": "x25519",
        "fingerprint": "x1-A4QE2WewCwwh8r",
        "path": "ik:v1:x25519/0/encryption/0"
      }
    }
    ```
  - [ ] Integration tests: fingerprint with persona, JSON output

### Phase 8: Update ASCII Armor (AC: 11)

- [ ] Task 8.1: Extend ASCII Armor Headers (AC: 11)

  - [ ] Update `src/cli/utils/armor.ts`
  - [ ] Add `Path` header: full derivation path (e.g., `ik:v1:x25519/0/encryption/0`)
  - [ ] Add `RootFingerprint` header: persona identity key fingerprint (e.g., `ed1-E8ZfCRNXoR5uoS`)
  - [ ] Update `Fingerprint` header to use base58 short form (e.g., `x1-A4QE2WewCwwh8r`)
  - [ ] Example updated armor:

    ```
    ----- BEGIN IDENTIKEY X25519 PRIVATE KEY -----
    Version: ik:v1
    KeyType: x25519
    Path: ik:v1:x25519/0/encryption/0
    Fingerprint: x1-A4QE2WewCwwh8r
    RootFingerprint: ed1-E8ZfCRNXoR5uoS
    Algorithm: xsalsa20poly1305

    <base64 encoded key data>
    <CRC24 checksum>
    ----- END IDENTIKEY X25519 PRIVATE KEY -----
    ```

  - [ ] Update armor() function to accept optional path and rootFingerprint parameters
  - [ ] Update dearmor() function to parse new headers
  - [ ] Unit tests: armor with new headers, dearmor parses correctly, roundtrip

### Phase 9: Test Vectors and KATs (AC: 12)

- [ ] Task 9.1: Implement Known-Answer Tests (AC: 12)

  - [ ] Create `tests/hd/kat-vectors.test.ts`
  - [ ] Implement test case for Ed25519 identity key derivation:
    - Seed (hex): `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`
    - Path: `ik:v1:ed25519/0/identity/0`
    - Expected sk (hex): `b127eb5092011c085345c8ce0bfeda6064f9e1249e29cc238c1d64bf2e587ce7`
    - Expected pk (base58): `CXUz8d1QzLvFQMcRhzPg4VYDfWCXhBxJvBJxp7NZz8wN`
    - Expected fingerprint short: `ed1-E8ZfCRNXoR5uoS`
  - [ ] Implement test case for X25519 encryption key derivation:
    - Seed (hex): same as above
    - Path: `ik:v1:x25519/0/encryption/0`
    - Expected sk (hex): `e86f2a431b893e71b1f549094b6a6d7c86f13a553492eb15808dfefd5411e364`
    - Expected pk (base58): `HwN2k8QvZxCxJhN4pM7TvR3kL5fY9gW2sB6xP1dA8zQy`
    - Expected fingerprint short: `x1-A4QE2WewCwwh8r`
  - [ ] Add determinism tests: same seed → same keys
  - [ ] Add cross-validation: verify against reference implementation

- [ ] Task 9.2: Implement HKDF Test Vectors (AC: 4, 12)
  - [ ] Create `tests/hd/hkdf-derivation.test.ts`
  - [ ] Test HKDF salt computation: `SHA-256(UTF-8("ik:x25519:root"))`
  - [ ] Test HKDF info encoding: `UTF-8("ik:v1:x25519/0/encryption/0")`
  - [ ] Test HKDF extract+expand output (32 bytes)
  - [ ] Test X25519 scalar clamping
  - [ ] Verify public key computation matches expected

### Phase 10: Integration Tests (AC: 14)

- [ ] Task 10.1: HD Persona Workflow Integration Tests (AC: 14)

  - [ ] Create `tests/cli/integration/hd-persona.test.ts`
  - [ ] Test full workflow:
    1. keygen --persona test (generates mnemonic + seed + dual keys)
    2. persona switch test
    3. encrypt < plaintext.txt (uses X25519 encryption key)
    4. decrypt < ciphertext (uses X25519 encryption key)
    5. fingerprint (shows both keys)
  - [ ] Test mnemonic recovery:
    1. Generate persona with keygen
    2. Save mnemonic
    3. Delete persona directory
    4. Restore from mnemonic (future feature, defer if not in scope)
  - [ ] Test passphrase protection:
    1. Generate persona
    2. Attempt decrypt with wrong passphrase (should fail)
    3. Decrypt with correct passphrase (should succeed)

- [ ] Task 10.2: ASCII Armor Integration Tests (AC: 11, 14)
  - [ ] Test armor with HD keys: keygen -a outputs armored keys with Path/RootFingerprint headers
  - [ ] Test dearmor: parse armored key, verify headers match persona metadata
  - [ ] Test encrypt -a with HD persona: armored ciphertext includes correct headers

### Phase 11: Documentation Updates (AC: 1, 8, 10)

- [ ] Task 11.1: Update CLI Documentation

  - [ ] Update README.md with HD key features:
    - BIP-39 mnemonic backup
    - Dual-key architecture explanation
    - Path structure documentation
    - Fingerprint format (base58)
  - [ ] Update keygen command help text with mnemonic warning
  - [ ] Update fingerprint command help text for dual-key display
  - [ ] Add migration guide for v1 → v2 format (if applicable)

- [ ] Task 11.2: Update Architecture Documentation
  - [ ] Verify `docs/architecture/hd-key-hierarchy-ik-v1.md` matches implementation
  - [ ] Verify `docs/architecture/story-2-2-hd-persona-architecture.md` matches implementation
  - [ ] Update `docs/architecture/ascii-armoring-spec.md` with new headers

## Dev Notes

### Learnings from Previous Story

**From Story 2-1-cli-tool-foundation (Status: done)**

**Key Generation Fixed (Curve25519 vs Ed25519):**

- Story 2-1 discovered that `generateKeyPair()` was using Ed25519 (`nacl.sign.keyPair()`) when encryption requires Curve25519 (`nacl.box.keyPair()`)
- Fixed in `src/keypair.ts` line 37 to use `nacl.box.keyPair()`
- **Critical for Story 2-2:** We now need BOTH key types:
  - Ed25519 for persona identity (signing)
  - X25519 for encryption (Curve25519 DH)
- Do NOT use `nacl.sign.keyPair()` for encryption keys
- Use @noble/curves for proper Ed25519 + X25519 primitives

**CLI Patterns to Reuse:**

- PersonaManager class structure works well (`src/cli/utils/persona-manager.ts`)
- Key encryption with Argon2id established (`src/cli/utils/key-encryption.ts`)
- ASCII armor utility clean (`src/cli/utils/armor.ts`)
- Atomic file writes (temp + rename) prevent corruption

**Testing Strategy:**

- Unit tests for each utility module (19 tests for PersonaManager, 15 for key encryption, 36 for armor)
- Integration tests for full CLI workflows
- KAT vectors critical for HD derivation (determinism)
- Cross-platform config path handling already implemented

**Technical Debt from Story 2-1:**

- Passphrase not zeroed from memory (MEDIUM - defer to future story)
- No path validation for directory traversal (MEDIUM - defer to future story)
- Duplicate `promptPassphrase` function (LOW - refactor during this story)

[Source: docs/stories/2-1-cli-tool-foundation.md#Completion-Notes]

### Architecture Alignment

**HD Key Hierarchy Specification:**

Story 2-2 implements `docs/architecture/hd-key-hierarchy-ik-v1.md`:

- **Persona Independence:** Each persona has its own master seed (from BIP-39 mnemonic)
- **Dual-Key Architecture:** Ed25519 identity + X25519 encryption (sibling derivation, not parent-child)
- **Derivation Methods:**
  - Ed25519: SLIP-0010 hardened-only (`HMAC-SHA512("ed25519 seed", seed)`)
  - X25519: HKDF-SHA512 with domain separation (`salt="ik:x25519:root"`, `info=path`)
- **Path Structure:** `ik:v1:<curve>/<account>/<role>/<index>`
  - Story 2-2 implements: account=0, role=identity/encryption, index=0
  - Future: rotation (index>0), delegation (account>0), additional curves
- **Fingerprints:** SHA-256(pubkey) → Base58 encoding (full or short with prefix)

[Source: docs/architecture/hd-key-hierarchy-ik-v1.md]

**Dual-Key Rationale:**

- **Ed25519 Identity Root:** Persona identity metadata requires signing (for future publishing)
- **X25519 Encryption:** Current encryption operations use X25519 (NaCl crypto_box)
- **Separation:** Cryptographic best practice - signing and encryption use different keys
- **Domain Separation:** Ed25519 and X25519 derived independently (not via runtime conversion)

[Source: docs/architecture/dual-key-persona-architecture.md#Rationale]

**Library Stack (Hybrid Approach):**

- **HD Derivation:** @scure/@noble stack (TweetNaCl doesn't support HD/BIP-39)
  - `@scure/bip39` - BIP-39 mnemonic generation
  - `@scure/bip32` - SLIP-0010 derivation for Ed25519
  - `@noble/hashes` - HKDF-SHA512, PBKDF2, SHA-256
  - `@noble/curves` - Ed25519 + X25519 primitives
- **Crypto Operations:** Keep TweetNaCl for `crypto_box` / `crypto_secretbox` (already working in Story 2-1)
- **Future Migration:** Plan transition to @noble/curves for consistency (defer to future story)

[Source: docs/architecture/story-2-2-hd-persona-architecture.md#Decision-7]

**Storage Structure:**

```
~/.config/identikey/
  personas/
    default/
      seed.json          # Encrypted master seed (NEW - replaces id.json)
      persona.json       # Persona metadata (NEW)
    work/
      seed.json
      persona.json
```

**seed.json Format:**

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

**persona.json Format:**

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

**Key Derivation On-Demand:** Keys are derived from encrypted seed when needed, never stored on disk.

[Source: docs/architecture/story-2-2-hd-persona-architecture.md#Decision-6]

**ASCII Armor Extensions:**

Add `Path` and `RootFingerprint` headers to link keys to persona identity:

```
----- BEGIN IDENTIKEY X25519 PRIVATE KEY -----
Version: ik:v1
KeyType: x25519
Path: ik:v1:x25519/0/encryption/0
Fingerprint: x1-A4QE2WewCwwh8r
RootFingerprint: ed1-E8ZfCRNXoR5uoS    ← NEW
Algorithm: xsalsa20poly1305

<base64 encoded key data>
<CRC24 checksum>
----- END IDENTIKEY X25519 PRIVATE KEY -----
```

[Source: docs/architecture/story-2-2-hd-persona-architecture.md#Decision-8]

### Project Structure Notes

**New Modules (Story 2.2):**

```
src/hd/
  mnemonic.ts          # BIP-39 mnemonic generation and seed derivation
  derive-ed25519.ts    # SLIP-0010 Ed25519 HD derivation
  derive-x25519.ts     # HKDF X25519 HD derivation
  path.ts              # Path parser and validator
  seed-encryption.ts   # Argon2id seed encryption
  storage.ts           # Seed and persona metadata file I/O

tests/hd/
  mnemonic.test.ts     # BIP-39 tests
  derive-ed25519.test.ts # SLIP-0010 tests
  derive-x25519.test.ts  # HKDF tests
  path.test.ts         # Path parsing tests
  seed-encryption.test.ts # Seed encryption tests
  kat-vectors.test.ts  # Known-answer tests (KATs)
  hkdf-derivation.test.ts # HKDF-specific tests
```

**Modified Modules (Story 2.2):**

```
src/keypair.ts                     # Add HD derivation functions
src/header/fingerprint.ts          # Update to Base58 (remove hex)
src/cli/utils/persona-manager.ts   # Refactor for seed-based derivation
src/cli/utils/armor.ts             # Add Path/RootFingerprint headers
src/cli/commands/keygen.ts         # Generate mnemonic + dual keys
src/cli/commands/encrypt.ts        # Use X25519 via path lookup
src/cli/commands/decrypt.ts        # Use X25519 via path lookup
src/cli/commands/fingerprint.ts    # Show both keys
src/cli/commands/persona.ts        # Handle seed-based personas
```

**Package.json Updates:**

Add HD key dependencies:

```json
{
  "dependencies": {
    "@scure/bip39": "^1.4.0",
    "@scure/bip32": "^1.5.0",
    "@noble/hashes": "^1.5.0",
    "@noble/curves": "^1.6.0"
  }
}
```

### Security Considerations

**Seed Protection:**

- Master seed encrypted at rest with Argon2id KDF (64MB memory, 3 iterations, parallelism=1)
- Passphrase required for all operations
- Keys derived on-demand, never stored on disk
- Seed file permissions set to 0600 (owner-only read/write)

**Domain Separation:**

- Ed25519 and X25519 use different derivation methods (SLIP-0010 vs HKDF)
- No runtime curve conversions (prevents cryptographic cross-contamination)
- Separate magic strings and HMAC keys

**Persona Isolation:**

- Independent seeds per persona (no shared entropy)
- No cross-persona metadata in derivation paths
- Enables per-persona threat modeling

**Mnemonic Display:**

- Show once during keygen with prominent warning
- Clear instruction to save securely (write down, offline storage)
- No recovery mechanism if mnemonic lost (must regenerate persona)

**Backward Compatibility:**

- Old v1 (single-key) format incompatible with v2 (HD dual-key)
- Clear error message with migration instructions
- No automatic migration (breaking change, requires user action)

### Testing Strategy

**Unit Tests:**

- BIP-39 mnemonic generation and validation
- SLIP-0010 Ed25519 derivation (master, child, path)
- HKDF X25519 derivation with domain separation
- Path parsing and validation
- Seed encryption/decryption with Argon2id
- Fingerprint computation and Base58 encoding
- ASCII armor with new headers
- Target: >90% coverage for src/hd/ directory

**Integration Tests:**

- Full keygen flow (mnemonic → seed → dual keys → storage)
- Encrypt/decrypt roundtrip with HD persona keys
- Fingerprint command with dual-key display
- ASCII armor with Path/RootFingerprint headers
- Persona switching with HD keys
- Passphrase protection (wrong passphrase fails)

**Known-Answer Tests (KATs):**

- Ed25519 identity key derivation matches spec vectors
- X25519 encryption key derivation matches spec vectors
- HKDF salt and info computation matches spec
- Fingerprint short form matches spec examples
- Determinism: same seed → same keys (100 iterations)

**Cross-Platform Tests:**

- Config path handling (Unix vs Windows)
- File permissions (0600 on Unix)
- Atomic file writes (temp + rename)

**Test Vectors (from spec):**

```typescript
// Seed (32 bytes, hex)
const testSeed = hexToBytes(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
);

// Ed25519 identity key (ik:v1:ed25519/0/identity/0)
const expectedEdPubkey = "CXUz8d1QzLvFQMcRhzPg4VYDfWCXhBxJvBJxp7NZz8wN"; // base58
const expectedEdFingerprintShort = "ed1-E8ZfCRNXoR5uoS";

// X25519 encryption key (ik:v1:x25519/0/encryption/0)
const expectedX25519Pubkey = "HwN2k8QvZxCxJhN4pM7TvR3kL5fY9gW2sB6xP1dA8zQy"; // base58
const expectedX25519FingerprintShort = "x1-A4QE2WewCwwh8r";
```

[Source: docs/architecture/hd-key-hierarchy-ik-v1.md#Test-Vectors]

### Cross-Platform Considerations

- **Mnemonic Display:** Use consistent UTF-8 encoding across platforms
- **Seed Storage:** Use Buffer for binary data (not string concatenation)
- **Config Path:** `~/.config/identikey` on Unix, `%APPDATA%/identikey` on Windows (already handled in Story 2-1)
- **File Permissions:** Set 0600 on Unix for seed.json (use `fs.chmod` with try-catch for Windows)
- **Atomic Writes:** Write to temp file, rename (atomic operation on most filesystems)

### References

- **Decision Document:** `docs/architecture/story-2-2-hd-persona-architecture.md` (complete architectural decisions)
- **HD Key Spec:** `docs/architecture/hd-key-hierarchy-ik-v1.md` (derivation methods, path structure, test vectors)
- **Dual-Key Architecture:** `docs/architecture/dual-key-persona-architecture.md` (rationale for Ed25519 + X25519)
- **Tech Spec:** `docs/tech-spec-epic-2.md` (Epic 2 overview, CLI requirements)
- **Previous Story:** `docs/stories/2-1-cli-tool-foundation.md` (CLI foundation, learnings, patterns)
- **ASCII Armor Spec:** `docs/architecture/ascii-armoring-spec.md` (armor format, CRC24, headers)

**Standards:**

- BIP-39: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- SLIP-0010: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
- HKDF: RFC 5869
- Ed25519: RFC 8032
- X25519: RFC 7748
- Argon2: RFC 9106

**Libraries:**

- @scure/bip39: https://github.com/paulmillr/scure-bip39
- @scure/bip32: https://github.com/paulmillr/scure-bip32
- @noble/hashes: https://github.com/paulmillr/noble-hashes
- @noble/curves: https://github.com/paulmillr/noble-curves

## Dev Agent Record

### Context Reference

- `docs/stories/2-2-dual-key-persona-architecture.context.xml` - Story context with documentation artifacts, code references, interfaces, constraints, dependencies, and test ideas

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

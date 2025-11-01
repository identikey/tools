# HD Key Hierarchy (ik:v1)

Status: Proposed
Owners: Security/Platform
Version: ik:v1

## Overview

- Single master seed → two hardened branches:
  - Ed25519 (signing/identity)
  - X25519 (encryption/key agreement)
- No runtime curve conversion. Domain separation for safety and auditability.
- Compatible with current TweetNaCl usage; future-proof for libsodium.

## Decision Summary (MVP)

| Category           | Decision                                               | Version | Rationale                                  |
| ------------------ | ------------------------------------------------------ | ------- | ------------------------------------------ |
| Derivation Ed25519 | HKDF-SHA512 hardened with domain-separated info        | Spec    | Uniform method; native string path support |
| Derivation X25519  | HKDF-SHA512 hardened with domain-separated info        | Spec    | Deterministic, auditable, curve-safe       |
| AEAD (baseline)    | NaCl crypto_box / crypto_secretbox (XSalsa20-Poly1305) | MVP     | Simple, audited, interoperable             |
| KDFs               | HKDF-SHA512 for hierarchy/subkeys                      | Spec    | Strong extract+expand; stable              |
| Fingerprints       | SHA-256(pubkey) 32 bytes; short base58btc              | Spec    | Collision-resistant; concise display       |
| Rotation           | Increment path index; keep historical keys             | Spec    | Backwards decryption guaranteed            |
| Caching            | None                                                   | N/A     | Keep MVP minimal                           |

## Seed

- 32-byte CSPRNG seed (preferred).
- Optional human backup: BIP39 mnemonic (PBKDF2-HMAC-SHA512, 2048) → 32-byte seed. Optionally harden with user passphrase (Argon2id) if required by threat model.

## Path Format (clean, versioned)

- Ed25519: `ik:v1:ed25519/<account>/<role>/<index>`
- X25519: `ik:v1:x25519/<account>/<role>/<index>`
- Examples:
  - `ik:v1:ed25519/0/identity/0` (persona identity root)
  - `ik:v1:x25519/0/encryption/0` (primary encryption)

**Path Semantics:**

- `<account>`: Purpose grouping (0=primary, 1=delegated, 2=specialized, etc.)
- `<role>`: Key purpose (identity, encryption, signing, auth, session, etc.)
- `<index>`: Rotation counter (0, 1, 2...) - increments on key rotation

**Persona Independence:**

- Each persona has its own master seed (from BIP-39 mnemonic)
- Personas are completely independent - no cross-persona metadata leakage
- No persona identifiers appear in derivation paths
- Personas can be "detached" and "attached" to different root keys (future feature)

Roles (examples): `identity`, `encryption`, `signing`, `auth`, `session`, `backup`.

## Protocol Identifiers and Magic Strings

All identifiers are ASCII, lower-case, hyphen-separated unless noted.

- Spec version tag: `ik:v1`
- Path prefix (Ed): `ik:v1:ed25519/`
- Path prefix (X): `ik:v1:x25519/`
- HKDF salt label (Ed root): `ik:ed25519:root` (SHA-256 of this UTF-8 string used as HKDF salt)
- HKDF salt label (X root): `ik:x25519:root` (SHA-256 of this UTF-8 string used as HKDF salt)
- HKDF info (per path): Full path string as UTF-8, e.g., `ik:v1:ed25519/<account>/<role>/<index>`
- Header fields (when embedded in other protocols):
  - `path`: full derivation path string
  - `fingerprint`: hex-encoded 32-byte SHA-256(pubkey)
  - `algorithm`: one of: `xsalsa20poly1305`, `xchacha20poly1305` (migration target)

Magic constants MUST NOT change within `ik:v1`. New versions define new tags.

## Derivation

**Uniform HKDF-SHA512 for All Keys**

All keys (Ed25519, X25519, and future key types) use HKDF-SHA512 with explicit domain separation via curve-specific salts and path-based info parameters.

### Ed25519 (HKDF-SHA512 hardened)

- Use HKDF-SHA512 with explicit domain separation.
- Derivation:
  - `salt = SHA-256("ik:ed25519:root")`
  - `info = UTF8("ik:v1:ed25519/" + account + "/" + role + "/" + index)`
  - `sk_raw = HKDF-SHA512(seed, salt, info, 32)` → clamp per Ed25519 rules
  - `pk = Ed25519 basepoint mul(sk_raw)`
- Deterministic, path-separated; no public derivation.

### X25519 (HKDF-SHA512 hardened)

- Use HKDF-SHA512 with explicit domain separation.
- Derivation:
  - `salt = SHA-256("ik:x25519:root")`
  - `info = UTF8("ik:v1:x25519/" + account + "/" + role + "/" + index)`
  - `sk_raw = HKDF-SHA512(seed, salt, info, 32)` → clamp to X25519 scalar
  - `pk = scalarMult.base(sk_raw)`
- Deterministic, path-separated; no public derivation.

**Rationale for HKDF Uniformity:**

- Custom string paths (`ik:v1:...`) incompatible with hardware wallets regardless of method
- HKDF's info parameter designed for semantic path strings (native fit)
- Single derivation method simplifies implementation and auditing
- Extensible to arbitrary curves (secp256k1, Kyber, Dilithium) without method changes
- Cryptographically equivalent security to SLIP-0010 with simpler implementation

## Encoding and Serialization

- Keys: raw byte arrays; public keys 32 bytes; private scalars 32 bytes (clamped as per curve rules).
- Fingerprints: 32 bytes SHA-256(pubkey); stored raw internally, **always displayed as base58btc** (full or short form with prefix).
- Paths: UTF-8 strings matching `ik:v1:(ed25519|x25519)/<account>/<role>/<index>`.
- Envelopes: JSON objects as specified; byte fields encoded as base64url unless binary container is used.
- Nonces: 24 bytes random; base64url in JSON.
- All textual constants are UTF-8.

## Cryptography Choices

- **AEAD (baseline)**: NaCl `crypto_box` (X25519 + XSalsa20-Poly1305)
  - For large payloads: generate random CEK (32 bytes) and encrypt body with `crypto_secretbox`. Encrypt CEK per-recipient with `crypto_box`.
- **Modern AEAD (optional upgrade)**: libsodium `crypto_aead_xchacha20poly1305_ietf` for CEK; `crypto_box_seal` for envelopes. Migration plan below.
- **KDFs**:
  - Hierarchy: HKDF-SHA512 (Extract+Expand) for X25519 branch and any subkeys.
  - Per-message: either raw `crypto_box` shared secret, or HKDF a subkey for CEK derivation.

## Fingerprints

- Compute `fp = SHA-256(pubkey)`; store 32 bytes internally.
- **All display/API:** Base58-encoded only (no hex).
- **Full form:** Base58btc encoding of full 32 bytes
- **Short form:** Base58btc of first 10 bytes, prefixed by type: `ed1-<short>`, `x1-<short>`

**Examples:**

- Full: `E8ZfCRNXoR5uoS9vV4uYJkLm3nP7qR2sT8wX1zA5bC4`
- Short: `ed1-E8ZfCRNXoR5uoS` (Ed25519 key)
- Short: `x1-A4QE2WewCwwh8r` (X25519 key)

## Rotation & Revocation

- Rotate by incrementing `<index>`; keep previous keys to decrypt historical data.
- Mark current key in metadata; attach `path` and `fingerprint` to encrypted headers.
- Publish signed revocations with Ed25519 root when retiring keys.

## Multi-Recipient Envelope (Hybrid)

Structure:

```json
{
  "alg": "xsalsa20poly1305",
  "body_nonce": "24b",
  "body_ct": "..",
  "recipients": [
    { "pk_eph": "32b", "nonce": "24b", "cek_ct": "..", "to": "x1-..fp" }
  ]
}
```

Flow:

1. Generate CEK (32 bytes) and `body_nonce` (24 bytes) → `secretbox(plaintext, body_nonce, CEK)`.
2. For each recipient `R`: create sender-ephemeral X25519 keypair; compute `box(CEK, nonce_R, sk_eph, pk_R)`; append `{pk_eph, nonce_R, cek_ct_R}`.
3. Nonces MUST be unique per body and per recipient envelope.

Field encodings (JSON):

- `alg`: string, e.g., `"xsalsa20poly1305"`
- `body_nonce`: base64url(24 bytes)
- `body_ct`: base64url(bytes)
- `recipients[]` items:
  - `pk_eph`: base64url(32 bytes)
  - `nonce`: base64url(24 bytes)
  - `cek_ct`: base64url(bytes)
  - `to`: short fingerprint string `x1-<base58btc(first 10 bytes)>`

## Migration (TweetNaCl → libsodium)

- Keep derivations identical (SLIP-0010, HKDF-SHA512).
- Swap:
  - CEK encryption → `crypto_aead_xchacha20poly1305_ietf`
  - Envelopes → `crypto_box_seal`
- Maintain interop vectors: encrypt CEK with tweetnacl, decrypt with libsodium (and vice versa) during migration window.

## Security Notes

- Strict domain separation: separate seeds/paths for Ed and X branches.
- No ed↔x conversions in runtime.
- Nonce reuse is catastrophic: always random 24-byte nonces; never reuse across messages.
- Store private material in OS keystore/secure enclave when available. Zeroize buffers after use where possible.
- Threat-model dependent: if mnemonic UX used, consider Argon2id hardening of passphrase-derived seed for device compromise scenarios.

## Implementation Pointers (TS)

- Derivation helpers:
  - Ed25519: HKDF-SHA512 + clamp (Ed25519 rules) → basepoint mul
  - X25519: HKDF-SHA512 + clamp (X25519 rules) → `scalarMult.base`
  - Uniform implementation for all curves
- KeyManager maps `fingerprint → { type, path, publicKey, secretRef }`.
- Headers embed `{ path, fingerprint, algorithm }`.

### Minimal API Signatures (TypeScript, indicative)

```ts
// Uniform Derivation
deriveKey(
  seed: Uint8Array,
  path: string,
  curve: 'ed25519' | 'x25519' | 'secp256k1' | ...
): { sk: Uint8Array; pk: Uint8Array };

// Convenience wrappers
deriveEd(path: string, seed: Uint8Array): { sk: Uint8Array; pk: Uint8Array };
deriveX(path: string, seed: Uint8Array): { sk: Uint8Array; pk: Uint8Array };

// Fingerprints
fingerprint(pk: Uint8Array): { fullHex: string; short: string };

// Envelope operations (baseline NaCl)
encryptEnvelope(
  plaintext: Uint8Array,
  recipients: Array<{ pkRecipient: Uint8Array; fpShort: string }>
): EnvelopeJson;

decryptEnvelope(
  env: EnvelopeJson,
  resolver: (fpShort: string) => { sk: Uint8Array; pk: Uint8Array } | null
): Uint8Array;

// Types
type EnvelopeJson = {
  alg: 'xsalsa20poly1305';
  body_nonce: string; // base64url
  body_ct: string;    // base64url
  recipients: Array<{ pk_eph: string; nonce: string; cek_ct: string; to: string }>;
};
```

### Reference Structure (MVP guidance)

```
src/crypto/
  hd-derivation.ts # Uniform HKDF-SHA512 derivation for all curves
  ed25519.ts       # Ed25519-specific clamping and public key generation
  x25519.ts        # X25519-specific clamping and public key generation
  fingerprints.ts  # SHA-256 and short form helpers
  envelope.ts      # encryptEnvelope / decryptEnvelope (NaCl)
src/keys/
  key-manager.ts  # fingerprint → { type, path, pk, secretRef }
src/protocol/
  constants.ts    # magic strings and tags for ik:v1
  paths.ts        # path parser/validator
  encode.ts       # base64url helpers
```

Naming: kebab-case files; verb-first function names; explicit types.

## Test Plan

- Vectors: known seed → deterministic Ed/X keys (paths).
- Nonce uniqueness property tests.
- Cross-implementation (tweetnacl vs libsodium) CEK envelope tests.
- Rotation: decrypt old payloads with previous index; new payloads with current.

## Test Vectors (ik:v1)

Deterministic Known-Answer Tests (KATs) for interop. Private keys and seeds shown in hex for precision; public keys and fingerprints in base58btc for consistency with production display.

**Note:** These vectors need to be regenerated with HKDF-SHA512 derivation. The vectors below are placeholders pending implementation of `scripts/generate-hd-kats.mjs` with HKDF method.

Seed (32 bytes, hex):

```
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
```

### Ed25519 Test Vector

Path: `ik:v1:ed25519/0/identity/0`

HKDF Parameters:

- Salt: `SHA-256("ik:ed25519:root")` = `0x7a8f2e3b...` (32 bytes)
- Info: `"ik:v1:ed25519/0/identity/0"` (UTF-8 bytes)
- Output: 32 bytes

```
sk_hex = [TO BE GENERATED]
pk_base58 = [TO BE GENERATED]
fingerprint_full  = [TO BE GENERATED]
fingerprint_short = ed1-[TO BE GENERATED]
```

### X25519 Test Vector

Path: `ik:v1:x25519/0/encryption/0`

HKDF Parameters:

- Salt: `SHA-256("ik:x25519:root")` = `0x4c7d9a1f...` (32 bytes)
- Info: `"ik:v1:x25519/0/encryption/0"` (UTF-8 bytes)
- Output: 32 bytes

```
sk_hex = [TO BE GENERATED]
pk_base58 = [TO BE GENERATED]
fingerprint_full  = [TO BE GENERATED]
fingerprint_short = x1-[TO BE GENERATED]
```

### Derivation Process (Reference Implementation)

```typescript
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";

function deriveKey(
  seed: Uint8Array,
  path: string,
  curve: "ed25519" | "x25519"
) {
  // 1. Compute salt from curve label
  const saltLabel = `ik:${curve}:root`;
  const salt = sha256(Buffer.from(saltLabel, "utf8"));

  // 2. Use full path as info parameter
  const info = Buffer.from(path, "utf8");

  // 3. Derive key material via HKDF-SHA512
  const keyMaterial = hkdf(sha512, seed, salt, info, 32);

  // 4. Curve-specific clamping
  if (curve === "ed25519") {
    // Ed25519 clamping: sk[0] &= 248; sk[31] &= 127; sk[31] |= 64
    keyMaterial[0] &= 248;
    keyMaterial[31] &= 127;
    keyMaterial[31] |= 64;
  } else if (curve === "x25519") {
    // X25519 clamping: sk[0] &= 248; sk[31] &= 127; sk[31] |= 64
    keyMaterial[0] &= 248;
    keyMaterial[31] &= 127;
    keyMaterial[31] |= 64;
  }

  return keyMaterial;
}
```

Notes:

- HKDF salt per curve: `SHA-256("ik:ed25519:root")` or `SHA-256("ik:x25519:root")`
- Info parameter: Full UTF-8 path string (enables semantic derivation)
- Fingerprints: `SHA-256(pubkey)` → base58btc encoding
- **Production code:** Never display hex fingerprints; always use base58btc
- Vectors to be generated by `scripts/generate-hd-kats.mjs` (Story 2.2 implementation)

## Error Handling (Explicit TODOs for Later)

MVP defers deep error taxonomy; implement these post-MVP:

- Invalid path format or unknown role — TODO
- Nonce reuse detection and guardrails — TODO
- Key not found for recipient fingerprint — TODO
- Envelope integrity failure (MAC) — TODO
- Fingerprint collision handling policy — TODO
- Seed entropy/format validation — TODO

Integration guidance (minimal):

- KeyManager: `getByFingerprint(short)`, `getCurrent(pathPrefix)`, `rotate(pathPrefix)`
- Headers: always embed `{ path, fingerprint, algorithm }` where encryption occurs
- Logging: never log secrets; redact fingerprints to short form in logs

## Open Questions

- Do we need device-specific sub-branches (per-device keys)?
- Audit log schema for revocations/rotations.

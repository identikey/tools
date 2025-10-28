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

| Category           | Decision                                               | Version | Rationale                                            |
| ------------------ | ------------------------------------------------------ | ------- | ---------------------------------------------------- |
| Derivation Ed25519 | SLIP-0010 hardened-only                                | Spec    | Industry standard; avoids public derivation pitfalls |
| Derivation X25519  | HKDF-SHA512 hardened with domain-separated info        | Spec    | Deterministic, auditable, curve-safe                 |
| AEAD (baseline)    | NaCl crypto_box / crypto_secretbox (XSalsa20-Poly1305) | MVP     | Simple, audited, interoperable                       |
| KDFs               | HKDF-SHA512 for hierarchy/subkeys                      | Spec    | Strong extract+expand; stable                        |
| Fingerprints       | SHA-256(pubkey) 32 bytes; short base58btc              | Spec    | Collision-resistant; concise display                 |
| Rotation           | Increment path index; keep historical keys             | Spec    | Backwards decryption guaranteed                      |
| Caching            | None                                                   | N/A     | Keep MVP minimal                                     |

## Seed

- 32-byte CSPRNG seed (preferred).
- Optional human backup: BIP39 mnemonic (PBKDF2-HMAC-SHA512, 2048) → 32-byte seed. Optionally harden with user passphrase (Argon2id) if required by threat model.

## Path Format (clean, versioned)

- Ed25519: `ik:v1:ed25519/<account>/<role>/<index>`
- X25519: `ik:v1:x25519/<account>/<role>/<index>`
- Examples:
  - `ik:v1:ed25519/0/sign/0`
  - `ik:v1:x25519/0/enc/0`

Roles (examples): `sign`, `auth`, `enc`, `dec`, `session`, `backup`.

## Protocol Identifiers and Magic Strings

All identifiers are ASCII, lower-case, hyphen-separated unless noted.

- Spec version tag: `ik:v1`
- Path prefix (Ed): `ik:v1:ed25519/`
- Path prefix (X): `ik:v1:x25519/`
- HKDF salt label (X root): `ik:x25519:root` (SHA-256 of this UTF-8 string used as HKDF salt)
- HKDF info (per X path): `ik:v1:x25519/<account>/<role>/<index>` (UTF-8)
- Header fields (when embedded in other protocols):
  - `path`: full derivation path string
  - `fingerprint`: hex-encoded 32-byte SHA-256(pubkey)
  - `algorithm`: one of: `xsalsa20poly1305`, `xchacha20poly1305` (migration target)

Magic constants MUST NOT change within `ik:v1`. New versions define new tags.

## Derivation

### Ed25519 (SLIP-0010 hardened-only)

- Master: `HMAC-SHA512(key="ed25519 seed", seed)` → `(k_master, c_master)`
- Child (hardened): `HMAC-SHA512(c_parent, 0x00 || ser256(k_parent) || ser32(index))` → `(k_child, c_child)`
- Repeat per path segment; output private = `k_child` (clamped per Ed25519 rules), public = Ed25519 basepoint mul.

### X25519 (HKDF-based hardened)

- Use HKDF-SHA512 with explicit domain separation.
- At each path:
  - `salt = SHA-256("ik:x25519:root")` (or per-parent chain-code)
  - `info = UTF8("ik:v1:x25519/" + account + "/" + role + "/" + index)`
  - `sk_raw = HKDF-SHA512(seed, salt, info, 32)` → clamp to X25519 scalar
  - `pk = scalarMult.base(sk)`
- Deterministic, branch-separated; no public derivation.

## Encoding and Serialization

- Keys: raw byte arrays; public keys 32 bytes; private scalars 32 bytes (clamped as per curve rules).
- Fingerprints: 32 bytes SHA-256(pubkey); stored raw, displayed as hex (full) or base58btc short form.
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

- Compute `fp = SHA-256(pubkey)`; store 32 bytes.
- Display short form: base58btc of first 10 bytes, prefixed by type: `ed1-<short>`, `x1-<short>`.

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
  - Ed25519: SLIP-0010 hardened-only
  - X25519: HKDF-SHA512 + clamp → `scalarMult.base`
- KeyManager maps `fingerprint → { type, path, publicKey, secretRef }`.
- Headers embed `{ path, fingerprint, algorithm }`.

### Minimal API Signatures (TypeScript, indicative)

```ts
// Derivation
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
  ed25519.ts      # SLIP-0010 hardened derivation
  x25519.ts       # HKDF-SHA512 hardened derivation
  fingerprints.ts # SHA-256 and short form helpers
  envelope.ts     # encryptEnvelope / decryptEnvelope (NaCl)
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

Deterministic Known-Answer Tests (KATs) for interop. All byte strings are hex unless noted.

Seed (32 bytes):

```
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
```

Ed25519 path: `ik:v1:ed25519/0/sign/0`

```
sk = b127eb5092011c085345c8ce0bfeda6064f9e1249e29cc238c1d64bf2e587ce7
pk = a798f3c57940cc37fbe4a01e344d0a39c670726b3b14bc435b980715e4a56977
fingerprint_hex   = e9b66c90acb1a9b730b510014dfa3afa83c944e5f35653f17acc07f5eaa469d8
fingerprint_short = ed1-E8ZfCRNXoR5uoS
```

X25519 path: `ik:v1:x25519/0/enc/0`

```
sk = e86f2a431b893e71b1f549094b6a6d7c86f13a553492eb15808dfefd5411e364
pk = ffe1151cb1b4b77cce780d5c9e6a7b30fb20f84fc4b157dc5e67945d48f94d30
fingerprint_hex   = a13cdb59dfe5e6e3cc173a9774e1e204909cf1bfcebca1a4fde61f51decb813d
fingerprint_short = x1-A4QE2WewCwwh8r
```

Notes:

- HKDF salt: `ik:x25519:root` → SHA-256 used as salt; info = full UTF-8 path string.
- Fingerprints: `SHA-256(pubkey)`, `fingerprint_short` = base58btc(first 10 bytes) with prefix `ed1-` or `x1-`.
- Vectors generated with Node crypto + TweetNaCl; see `scripts/generate-hd-kats.mjs` for reproduction.

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

# IdentiKey ASCII Armoring Specification

**Version:** 1.0  
**Date:** 2025-10-31  
**Status:** Draft

---

## Overview

This specification defines ASCII armoring formats for IdentiKey cryptographic artifacts, enabling text-safe transmission over channels that don't support binary data (email, chat, config files, etc.). Inspired by PGP's ASCII armor, these formats provide visual clarity, checksums for integrity, and extensible headers for metadata.

### Design Principles

- **Retro Aesthetic:** PGP-style block delimiters with clear semantic markers
- **Text-Safe:** Base58 for keys (Solana-style), Base64 for messages (efficiency)
- **Self-Describing:** Headers include version and type information
- **Verifiable:** CRC24 checksums detect corruption in transit
- **Efficient:** Minimal overhead beyond encoding expansion
- **Extensible:** Custom headers support future metadata needs
- **Side-Channel Resistant:** Optional padding to obscure plaintext size

### Scope

This specification covers armoring for:

1. **Public Keys** - For sharing encryption targets
2. **Private Keys** - For secure storage/backup (encrypted at rest)
3. **Encrypted Messages** - Full single-blob ciphertexts
4. **Multi-Part Messages** - Chunked messages with Merkle verification

---

## Format Conventions

All armored blocks follow this general structure:

```text
----- BEGIN IDENTIKEY <TYPE> -----
<headers>

<base64_encoded_data>
=<crc24_checksum>
----- END IDENTIKEY <TYPE> -----
```

### Common Elements

- **Delimiters:** Five dashes + space + keyword + space + five dashes
- **Headers:** `Key: Value` format, one per line, blank line after headers
- **Payload:** Base58 for keys (no wrapping), Base64 for messages (wrapped at 64 chars)
- **Checksum:** CRC24 of raw binary data (before encoding), prefixed with `=`
- **Whitespace:** Blank line separates headers from payload, no trailing whitespace

### Character Set

- ASCII printable characters only (0x20-0x7E)
- Line endings: LF (`\n`) preferred, CRLF (`\r\n`) tolerated on decode
- Base58 variant: Bitcoin alphabet (123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz)
- Base64 variant: Standard alphabet (A-Za-z0-9+/) with `=` padding

### Encoding by Type

- **Public/Private Keys:** Base58 (human-readable, familiar from Solana/crypto ecosystems)
- **Messages:** Base64 (more efficient for large payloads, standard email/MIME compatibility)

---

## Public Key Armor

### Format

```text
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
KeyType: <Ed25519|X25519>
Fingerprint: <sha256_hash_hex>
Created: <iso8601_timestamp>

<base58_encoded_public_key_32_bytes>
=<crc24_base58>
----- END IDENTIKEY PUBLIC KEY -----
```

### Headers

| Header        | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `Version`     | Yes      | Armor format version (currently `1`)                           |
| `KeyType`     | Yes      | `Ed25519` (signing/verification) or `X25519` (encryption/ECDH) |
| `Fingerprint` | Yes      | SHA-256 hash of public key bytes, hex-encoded                  |
| `Created`     | No       | ISO 8601 timestamp when key was generated                      |
| `Comment`     | No       | Human-readable label (e.g., "Alice's work key")                |

### Example

```text
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890
Created: 2025-10-31T14:23:45Z
Comment: Alice's primary signing key

5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
=2Zx
----- END IDENTIKEY PUBLIC KEY -----
```

### Encoding Rules

1. Start with raw 32-byte Ed25519 or X25519 public key
2. Calculate CRC24 of raw bytes → 3 bytes → base58 encode → ~4 chars
3. Base58 encode raw public key → ~44 chars (32 bytes, no padding)
4. No line wrapping needed (single line for keys)

---

## Private Key Armor (Encrypted)

### Format

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: <Ed25519|X25519>
Fingerprint: <sha256_hash_of_public_key>
Encrypted: <algorithm>
Salt: <base64_salt>
Nonce: <base64_nonce>

<base58_encoded_encrypted_private_key>
=<crc24_base58>
----- END IDENTIKEY PRIVATE KEY -----
```

### Headers

| Header        | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `Version`     | Yes      | Armor format version (currently `1`)                           |
| `KeyType`     | Yes      | `Ed25519` (signing/verification) or `X25519` (encryption/ECDH) |
| `Fingerprint` | Yes      | SHA-256 hash of corresponding public key                       |
| `Encrypted`   | Yes      | Encryption algorithm (e.g., `XSalsa20-Poly1305`)               |
| `Salt`        | Yes      | Base64-encoded salt for passphrase KDF (16 bytes)              |
| `Nonce`       | Yes      | Base64-encoded encryption nonce (24 bytes)                     |
| `Comment`     | No       | Human-readable label                                           |

### Example

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890
Encrypted: XSalsa20-Poly1305
Salt: rK8vL3xM9gH7sF6jP2aY1eU=
Nonce: c5hN2iT9xV4zW7yQ3mG6lO1rE8fD9kH=
Comment: Alice's primary signing key (encrypted)

3J8mCcbiZwltokjFkNnvaBepnbYz8AwNj9nsCO6dANCMqR5vP2xO0sT8hI1lE7tG
=3Ay
----- END IDENTIKEY PRIVATE KEY -----
```

### Security Notes

- Salt/Nonce must be cryptographically random (not derived from passphrase)
- Default KDF: Argon2id with 64MB memory, 3 iterations, parallelism=1
- Encrypted payload = `encrypt(raw_privkey, kdf(passphrase, salt))` + Poly1305 MAC
- Base58 encoding maintains consistency with public key format

---

## Private Key Armor (Unencrypted)

### Format

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: <Ed25519|X25519>
Fingerprint: <sha256_hash_of_public_key>
Encrypted: false
Warning: UNENCRYPTED - INSECURE STORAGE

<base58_encoded_private_key>
=<crc24_base58>
----- END IDENTIKEY PRIVATE KEY -----
```

### Headers

| Header        | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `Version`     | Yes      | Armor format version (currently `1`)                           |
| `KeyType`     | Yes      | `Ed25519` (signing/verification) or `X25519` (encryption/ECDH) |
| `Fingerprint` | Yes      | SHA-256 hash of corresponding public key                       |
| `Encrypted`   | Yes      | Must be `false` for unencrypted keys                           |
| `Warning`     | Yes      | Must include "UNENCRYPTED" or "INSECURE"                       |
| `Comment`     | No       | Human-readable label                                           |

### Example

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
Encrypted: false
Warning: UNENCRYPTED - INSECURE STORAGE
Comment: Passwordless convenience key

2K9nDdbjaXwmupleOnvoaCfqocZz9BxOk0osDp7eBODNrS6wQ3yP1tU9iJ2mF8uH
=4Bz
----- END IDENTIKEY PRIVATE KEY -----
```

### Security Warnings

**⚠️ WARNING: UNENCRYPTED PRIVATE KEYS ARE INSECURE**

- **Risk:** Anyone with file access can steal the key (no passphrase protection)
- **Use Cases:** Convenience over security, automated systems, low-value operations
- **User Choice:** Tools MUST warn users but allow unencrypted keys if user opts in
- **Validation:** Parsers MUST display prominent warning when loading unencrypted keys
- **Best Practice:** Use encrypted keys with passphrases for sensitive operations
- **Mitigation:** Set file permissions to 0600 (owner-only read/write) at minimum

---

## Encrypted Message Armor (Full)

### Format

```text
----- BEGIN IDENTIKEY MESSAGE -----
Version: 1
RecipientFingerprint: <sha256_hash_hex>
SenderPublicKey: <base58_sender_pubkey>
Nonce: <base64_nonce>
OriginalSize: <bytes>
Padding: <bytes>
Signature: <base58_ed25519_signature>

<base64_encoded_ciphertext>
=<crc24_base64>
----- END IDENTIKEY MESSAGE -----
```

### Headers

| Header                 | Required | Description                                           |
| ---------------------- | -------- | ----------------------------------------------------- |
| `Version`              | Yes      | Armor format version (currently `1`)                  |
| `RecipientFingerprint` | Yes      | SHA-256 hash of recipient's X25519 public key         |
| `SenderPublicKey`      | No       | Base58-encoded sender's Ed25519 public key (32 bytes) |
| `Nonce`                | Yes      | Base64-encoded encryption nonce (24 bytes)            |
| `OriginalSize`         | Yes      | Size in bytes of original plaintext (before padding)  |
| `Padding`              | No       | Number of padding bytes appended (default: 0)         |
| `Signature`            | No       | Base58-encoded Ed25519 signature of canonical headers |
| `Created`              | No       | ISO 8601 timestamp when message was encrypted         |
| `Comment`              | No       | Human-readable note                                   |

### Example

```text
----- BEGIN IDENTIKEY MESSAGE -----
Version: 1
RecipientFingerprint: e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
SenderPublicKey: 5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
Nonce: b6hN3iT0xV5zW8yQ4mG7lO2rE9fC0kI=
OriginalSize: 512
Padding: 256
Signature: 4KqZ8jXgY5mDnR9uBbP6fT3hL8sV2wE1aG4jC7kN0xH9iM5pS6tU
Created: 2025-10-31T14:30:00Z

jH7kD3sF6jP1aY0eU8cB5hN2iT9xV4zW7yQ3mG6lO1rE8fA9bC2dK5mN8pQ1sT4
vX7yZ0lM3nP6rU9wB8cE1fH4jL7oR0tY3aD6gK9mP2sV5xC8zF1hJ4nQ7uA0dG3
iL6oR9tY2bE5hK8nQ1sU4vX7zC0fI3lO6rB9uD2gJ5mP8sV1wE4xH7kN0aG3jL6
pS9tW2cF5hK8nQ1uX4yA7zC0fI3lO6rB9uD2gJ5mP8sV1wE4xH7kN0aG3jL6pS9
=xR5m
----- END IDENTIKEY MESSAGE -----
```

### Signature Generation

Signatures authenticate the message metadata (headers) using Ed25519:

1. **Canonicalize Headers:** Sort all headers alphabetically (excluding `Signature`), format as `Key: Value\n`
2. **Hash:** Compute `SHA-256(canonical_headers)` → 32 bytes
3. **Sign:** Use sender's Ed25519 private key to sign hash → 64-byte signature
4. **Encode:** Base58 encode signature → `Signature` header value

**Example Canonical Text:**

```text
Created: 2025-10-31T14:30:00Z
Nonce: b6hN3iT0xV5zW8yQ4mG7lO2rE9fC0kI=
OriginalSize: 512
Padding: 256
RecipientFingerprint: e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
SenderPublicKey: 5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
Version: 1
```

→ SHA-256 → Ed25519 sign → Base58 encode → `Signature` header

### Padding for Side-Channel Resistance

Padding obscures the true plaintext size to prevent size-based correlation attacks:

- **Padding Bytes:** Random bytes appended to plaintext before encryption
- **Padding Header:** Specifies number of padding bytes (decrypt strips them)
- **Strategy:** Round up to nearest power-of-2 or fixed bucket (256B, 1KB, 10KB, 100KB, 1MB)
- **Default:** No padding (0 bytes) for efficiency, enable for sensitive use cases

**Example:**

```typescript
// Original: 450 bytes → Pad to 1024 bytes → Padding: 574
const plaintext = new Uint8Array(450);
const padding = new Uint8Array(574).fill(0); // or random bytes
const padded = concat(plaintext, padding);
encrypt(padded); // → OriginalSize: 450, Padding: 574
```

### Usage Notes

- Used for single-recipient, non-chunked encrypted data
- Nonce must be unique per encryption (never reuse with same key)
- `SenderPublicKey` + `Signature` enable authenticated encryption (optional but recommended)
- Ciphertext includes Poly1305 MAC for authenticity
- Base64 for message payload (efficient for large data)

---

## Multi-Part Message Armor

### Format

```text
----- BEGIN IDENTIKEY MESSAGE PART <part_num>/<total_parts> -----
Version: 1
Part: <part_num>/<total_parts>
MerkleRoot: <blake2b_hash_hex>
ChunkHash: <blake2b_hash_hex>
AuthPath: [<hash1>, <hash2>, ...]
BytesTotal: <total_plaintext_bytes>
PartSlotsTotal: <slots_available>
PartSlotsUsed: <slots_used>
Signature: <ecdsa_signature_hex>
SignerPublicKey: <hex_pubkey>

<base64_encoded_ciphertext_chunk>
=<crc24>
----- END IDENTIKEY MESSAGE PART <part_num>/<total_parts> -----
```

### Headers

| Header            | Required | Description                                              |
| ----------------- | -------- | -------------------------------------------------------- |
| `Version`         | Yes      | Armor format version (currently `1`)                     |
| `Part`            | Yes      | Part number and total (e.g., `3/8`)                      |
| `MerkleRoot`      | Yes      | BLAKE2b hash of Merkle tree root (64 chars hex)          |
| `ChunkHash`       | Yes      | BLAKE2b hash of this part's payload (before base64)      |
| `AuthPath`        | Yes      | JSON array of hex hashes for Merkle verification         |
| `BytesTotal`      | Yes      | Total size of original plaintext across all parts        |
| `PartSlotsTotal`  | Yes      | Total coefficient slots available (crypto context param) |
| `PartSlotsUsed`   | Yes      | Slots used in this part's ciphertext                     |
| `Signature`       | Yes      | ECDSA signature of canonicalized headers                 |
| `SignerPublicKey` | Yes      | Hex-encoded ECDSA public key of signer                   |
| `CharacterSet`    | No       | Character set of original plaintext (default: `UTF-8`)   |
| `Comment`         | No       | Human-readable note                                      |

### Example

```text
----- BEGIN IDENTIKEY MESSAGE PART 1/8 -----
Version: 1
Part: 1/8
MerkleRoot: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890
ChunkHash: b2c3d4e5f67890a1bcdef234567890a1bcdef234567890a1bcdef234567890a1
AuthPath: ["c3d4e5f6789012", "d4e5f6789012ab", "e5f6789012abcd"]
BytesTotal: 8192
PartSlotsTotal: 1024
PartSlotsUsed: 1024
Signature: 3045022100a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890022012345678901234567890abcdef1234567890abcdef1234567890abcdef123456
SignerPublicKey: 04a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
CharacterSet: UTF-8
Comment: Part 1 of encrypted document

jK9vM2xN5qR8gH0kD6sF3jP4aY7eU1cB8hN5iT2xV9zW4yQ0mG3lO8rE5fA6bC1
dK8mN1pQ4sT7vX0yZ3lM6nP9rU2wB5cE8fH1jL4oR7tY0aD3gK6mP9sV2xC5zF8
hJ1nQ4uA7dG0iL3oR6tY9bE2hK5nQ8sU1vX4zC7fI0lO3rB6uD9gJ2mP5sV8wE1
xH4kN7aG0jL3pS6tW9cF2hK5nQ8uX1yA4zC7fI0lO3rB6uD9gJ2mP5sV8wE1xH4
=mT7p
----- END IDENTIKEY MESSAGE PART 1/8 -----
```

### Multi-Part Rules

1. **Part Numbering:** 1-indexed (first part is `1/N`, not `0/N`)
2. **Merkle Verification:** Each part must include `AuthPath` to compute root
3. **Signature Coverage:** Signature covers all headers except `Signature` itself (canonicalized alphabetically)
4. **Independent Transmission:** Parts can be transmitted/stored separately
5. **Reassembly:** All parts must have matching `MerkleRoot` to reassemble
6. **Order Independence:** Parts can be received in any order
7. **Encoding:** Base64 for message parts (efficient for large ciphertext chunks)

### Canonical Header Format for Signing

**Critical:** The `Signature` field is computed over all OTHER headers, then added afterward. This avoids circular dependency.

**Process:**

1. Collect all headers EXCEPT `Signature`
2. Sort alphabetically by key
3. Format as `Key: Value\n` (newline after each)
4. Concatenate into single string
5. Compute `SHA-256(canonical_string)` → 32-byte hash
6. Sign hash with Ed25519 private key → 64-byte signature
7. Base58 encode signature → add as `Signature` header

**Example Canonical Text (Multi-Part):**

```text
AuthPath: ["c3d4e5f6789012", "d4e5f6789012ab", "e5f6789012abcd"]
BytesTotal: 8192
CharacterSet: UTF-8
ChunkHash: b2c3d4e5f67890a1bcdef234567890a1bcdef234567890a1bcdef234567890a1
Comment: Part 1 of encrypted document
MerkleRoot: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890
Part: 1/8
PartSlotsTotal: 1024
PartSlotsUsed: 1024
SignerPublicKey: 5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
Version: 1
```

→ SHA-256 → Ed25519 sign → Base58 → `Signature: 4KqZ8jX...` (added to headers)

---

## Proxy Re-Encrypted Message Armor

### Format

```text
----- BEGIN IDENTIKEY RECRYPTED MESSAGE -----
Version: 1
Part: 1/1
Recrypted: true
OriginalSender: <hex_pubkey>
RecryptedBy: <hex_proxy_pubkey>
RecryptedFor: <hex_recipient_pubkey>
RecryptionTimestamp: <iso8601>
BytesTotal: 512
ChunkHash: <blake2b_hash_hex>
PartSlotsTotal: 8192
PartSlotsUsed: 256
ProxySignature: <ecdsa_signature_hex>
ProxyPublicKey: <hex_pubkey>

<base64_encoded_recrypted_ciphertext>
=<crc24>
----- END IDENTIKEY RECRYPTED MESSAGE -----
```

### Headers

| Header                | Required | Description                                    |
| --------------------- | -------- | ---------------------------------------------- |
| `Version`             | Yes      | Armor format version (currently `1`)           |
| `Part`                | Yes      | Part number (usually `1/1` for recrypted msgs) |
| `Recrypted`           | Yes      | Set to `true` to indicate recryption           |
| `OriginalSender`      | Yes      | Hex public key of original sender (Alice)      |
| `RecryptedBy`         | Yes      | Hex public key of proxy service                |
| `RecryptedFor`        | Yes      | Hex public key of new recipient (Bob)          |
| `RecryptionTimestamp` | Yes      | ISO 8601 timestamp when recryption occurred    |
| `BytesTotal`          | Yes      | Original plaintext size                        |
| `ChunkHash`           | Yes      | BLAKE2b hash of recrypted payload              |
| `PartSlotsTotal`      | Yes      | Total coefficient slots available              |
| `PartSlotsUsed`       | Yes      | Slots used in recrypted ciphertext             |
| `ProxySignature`      | Yes      | ECDSA signature by proxy service               |
| `ProxyPublicKey`      | Yes      | Hex-encoded proxy service public key           |
| `Comment`             | No       | Human-readable note                            |

### Key Differences from Original Messages

- **No `MerkleRoot`:** Merkle verification invalidated by recryption
- **No `AuthPath`:** Cannot verify against original Merkle tree
- **No `Signature`:** Original sender's signature no longer valid
- **No `SignerPublicKey`:** Replaced by `ProxyPublicKey`
- **Added `Recrypted` flag:** Distinguishes from original messages
- **Added Audit Trail:** `OriginalSender`, `RecryptedFor`, timestamp

### Trust Model

Recipients verify:

1. `ProxySignature` using `ProxyPublicKey` (ensures proxy integrity)
2. `ChunkHash` matches payload (detects tampering post-recryption)
3. `OriginalSender` matches expected source (audit trail)
4. Proxy is trusted entity (out-of-band verification)

---

## CRC24 Checksum

### Algorithm

CRC24 detects transmission errors (not cryptographic integrity—use signatures for that).

**Polynomial:** `0x864CFB` (standard CRC24 used by OpenPGP)

**Implementation:**

```typescript
function crc24(data: Uint8Array): number {
  const CRC24_INIT = 0xb704ce;
  const CRC24_POLY = 0x1864cfb;

  let crc = CRC24_INIT;
  for (const byte of data) {
    crc ^= byte << 16;
    for (let i = 0; i < 8; i++) {
      crc <<= 1;
      if (crc & 0x1000000) {
        crc ^= CRC24_POLY;
      }
    }
  }
  return crc & 0xffffff;
}
```

**Encoding:**

```typescript
const crc = crc24(rawBytes); // 3-byte integer
const crcBytes = new Uint8Array([
  (crc >> 16) & 0xff,
  (crc >> 8) & 0xff,
  crc & 0xff,
]);
const crcBase64 = btoa(String.fromCharCode(...crcBytes)); // 4 chars
return `=${crcBase64}`;
```

**Example:**

```typescript
// Raw bytes: [0x01, 0x02, 0x03]
crc24([0x01, 0x02, 0x03]); // → 0x5C8D9F
// CRC bytes: [0x5C, 0x8D, 0x9F]
// Base64: "XI2f"
// Armored: "=XI2f"
```

---

## Line Wrapping

### Rules

- **Keys (Base58):** No wrapping (single line, ~44 chars for 32-byte keys)
- **Messages (Base64):** Wrap at 64 characters per line (not counting newline)
- **Payload Only:** Wrap payload, not headers or delimiters
- **Checksum:** CRC24 checksum on its own line (not wrapped)
- **Last Line:** May be shorter than 64 chars (no padding required)

### Example (Message - Wrapped)

```text
----- BEGIN IDENTIKEY MESSAGE -----
Version: 1
RecipientFingerprint: abc123...
Nonce: def456...
OriginalSize: 512

jH7kD3sF6jP1aY0eU8cB5hN2iT9xV4zW7yQ3mG6lO1rE8fA9bC2dK5mN8pQ1sT4
vX7yZ0lM3nP6rU9wB8cE1fH4jL7oR0tY3aD6gK9mP2sV5xC8zF1hJ4nQ7uA0dG3
iL6oR9tY2bE5hK8nQ1sU4vX7zC0fI3lO6rB9uD2gJ5mP8sV1wE4xH7kN0aG3jL6
=xR5m
----- END IDENTIKEY MESSAGE -----
```

### Example (Key - Not Wrapped)

```text
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: abc123...

5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
=2Zx
----- END IDENTIKEY PUBLIC KEY -----
```

---

## Parsing and Validation

### Decode Sequence

1. **Find Delimiters:** Locate `BEGIN` and `END` lines, extract type
2. **Parse Headers:** Split lines before first blank line, parse `Key: Value`
3. **Extract Payload:** Collect all lines between blank line and checksum line
4. **Verify Checksum:** Decode `=<crc24>` line, compute CRC of decoded bytes
5. **Validate Headers:** Check required headers present, values well-formed
6. **Return Data:** Output decoded binary data + parsed headers

### Validation Rules

- **Delimiter Match:** `BEGIN` and `END` types must match exactly
- **Version Check:** `Version` header must be supported (currently only `1`)
- **Checksum Match:** Computed CRC24 must equal armored checksum
- **Encoding Valid:** Base58 (keys) or Base64 (messages) must decode without errors
- **Required Headers:** All mandatory headers for type must be present
- **Key Type Check:** `KeyType` must be `Ed25519` or `X25519` for key types
- **Unencrypted Key Warning:** If `Encrypted: false`, validate `Warning` header exists and contains "UNENCRYPTED" or "INSECURE"

### Error Handling

| Error Condition            | Behavior                                          |
| -------------------------- | ------------------------------------------------- |
| Missing `BEGIN`/`END`      | Return "Invalid armor format"                     |
| Delimiter type mismatch    | Return "BEGIN/END type mismatch"                  |
| Unsupported version        | Return "Unsupported armor version"                |
| Missing required header    | Return "Missing required header: <name>"          |
| Invalid `KeyType`          | Return "KeyType must be Ed25519 or X25519"        |
| Unencrypted key no warning | Return "Unencrypted key missing security warning" |
| CRC24 mismatch             | Return "Checksum verification failed"             |
| Invalid encoding           | Return "Malformed Base58/Base64 payload"          |
| Extra data after `END`     | Warning (tolerate trailing whitespace/newlines)   |

---

## Implementation Notes

### Auto-Detection

Decoders should auto-detect armoring by scanning for:

```typescript
function isArmored(input: Buffer | string): boolean {
  const text = typeof input === "string" ? input : input.toString("utf-8");
  return /^----- BEGIN IDENTIKEY /.test(text.trimStart());
}

function getArmorType(armored: string): string | null {
  const match = armored.match(/^----- BEGIN IDENTIKEY (.*?) -----/);
  return match ? match[1] : null;
}
```

### Performance

- **Keys (Base58):** ~37% size increase vs raw bytes (32B → ~44 chars)
- **Messages (Base64):** ~33% size increase vs raw bytes + ~200 bytes headers
- **Decoding Speed:** Regex-based parsing ~1-5ms for typical keys/messages
- **Line Wrapping:** Use chunks of 48 raw bytes → 64 base64 chars per line

### Compatibility

- **Newlines:** Accept both LF and CRLF on decode, emit LF on encode
- **Whitespace:** Ignore all whitespace in payload (spaces, tabs, newlines)
- **Case Sensitivity:** Header keys are case-sensitive (`Version` ≠ `version`)
- **Unknown Headers:** Ignore unrecognized headers (forward compatibility)

### Security Considerations

- **CRC24 is NOT cryptographic:** Use signatures for integrity, CRC for transport errors only
- **Always verify signatures:** Check Ed25519 `Signature` header before trusting content
- **Side-Channel Leakage:** Armor reveals approximate plaintext size—use `Padding` for sensitive data
- **Metadata Exposure:** Headers may leak info (timestamps, comments)—minimize when needed
- **Unencrypted keys:** NEVER use in production—parsers should warn/reject by default
- **Base58 vs Base64:** Keys use Base58 (human-readable), messages use Base64 (efficient)

---

## Reference Implementation

### Encoding Example (TypeScript)

```typescript
import { crc24 } from "./crc24";
import { base58 } from "bs58";

function armorPublicKey(
  publicKey: Uint8Array,
  keyType: "Ed25519" | "X25519",
  comment?: string
): string {
  const fingerprint = sha256(publicKey).toString("hex");
  const payload = base58.encode(publicKey); // Base58 for keys
  const checksum = crc24(publicKey);
  const crcBytes = new Uint8Array([
    (checksum >> 16) & 0xff,
    (checksum >> 8) & 0xff,
    checksum & 0xff,
  ]);
  const crcBase58 = base58.encode(crcBytes);

  const headers = [
    "Version: 1",
    `KeyType: ${keyType}`,
    `Fingerprint: ${fingerprint}`,
    `Created: ${new Date().toISOString()}`,
  ];
  if (comment) headers.push(`Comment: ${comment}`);

  return [
    "----- BEGIN IDENTIKEY PUBLIC KEY -----",
    ...headers,
    "",
    payload,
    `=${crcBase58}`,
    "----- END IDENTIKEY PUBLIC KEY -----",
  ].join("\n");
}
```

### Decoding Example (TypeScript)

```typescript
import { base58 } from "bs58";

function dearmorPublicKey(armored: string): {
  data: Uint8Array;
  headers: Record<string, string>;
} {
  const lines = armored.split(/\r?\n/);

  // Find delimiters
  const beginIdx = lines.findIndex((l) =>
    l.startsWith("----- BEGIN IDENTIKEY PUBLIC KEY -----")
  );
  const endIdx = lines.findIndex((l) =>
    l.startsWith("----- END IDENTIKEY PUBLIC KEY -----")
  );
  if (beginIdx === -1 || endIdx === -1) throw new Error("Invalid armor format");

  // Parse headers
  const headers: Record<string, string> = {};
  let payloadStart = beginIdx + 1;
  for (let i = beginIdx + 1; i < endIdx; i++) {
    if (lines[i].trim() === "") {
      payloadStart = i + 1;
      break;
    }
    const [key, ...valueParts] = lines[i].split(": ");
    headers[key] = valueParts.join(": ");
  }

  // Validate unencrypted private key warning
  if (headers.Encrypted === "false") {
    console.warn("⚠️  UNENCRYPTED PRIVATE KEY - INSECURE STORAGE");
    if (!headers.Warning?.match(/UNENCRYPTED|INSECURE/i)) {
      throw new Error("Unencrypted key missing security warning");
    }
  }

  // Extract payload and checksum
  const payloadLines = lines
    .slice(payloadStart, endIdx)
    .filter((l) => !l.startsWith("="));
  const checksumLine = lines
    .slice(payloadStart, endIdx)
    .find((l) => l.startsWith("="));
  if (!checksumLine) throw new Error("Missing checksum");

  const payloadBase58 = payloadLines.join("");
  const data = base58.decode(payloadBase58); // Base58 for keys

  // Verify checksum
  const expectedCrc = base58.decode(checksumLine.slice(1));
  const expectedCrcInt =
    (expectedCrc[0] << 16) | (expectedCrc[1] << 8) | expectedCrc[2];
  const actualCrc = crc24(data);
  if (actualCrc !== expectedCrcInt)
    throw new Error("Checksum verification failed");

  return { data, headers };
}
```

---

## Examples Gallery

### Ed25519 Signing Key (Encrypted)

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890
Encrypted: XSalsa20-Poly1305
Salt: rK8vL3xM9gH7sF6jP2aY1eU=
Nonce: c5hN2iT9xV4zW7yQ3mG6lO1rE8fD9kH=
Comment: Production signing key

3J8mCcbiZwltokjFkNnvaBepnbYz8AwNj9nsCO6dANCMqR5vP2xO0sT8hI1lE7tG
=3Ay
----- END IDENTIKEY PRIVATE KEY -----
```

### X25519 Encryption Key (Unencrypted)

```text
----- BEGIN IDENTIKEY PRIVATE KEY -----
Version: 1
KeyType: X25519
Fingerprint: e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
Encrypted: false
Warning: UNENCRYPTED - INSECURE STORAGE
Comment: Convenience key for dev environment

2K9nDdbjaXwmupleOnvoaCfqocZz9BxOk0osDp7eBODNrS6wQ3yP1tU9iJ2mF8uH
=4Bz
----- END IDENTIKEY PRIVATE KEY -----
```

### Minimal Public Key

```text
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
KeyType: Ed25519
Fingerprint: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890

5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
=2Zx
----- END IDENTIKEY PUBLIC KEY -----
```

### Authenticated Encrypted Message with Padding

```text
----- BEGIN IDENTIKEY MESSAGE -----
Version: 1
RecipientFingerprint: e5f67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12
SenderPublicKey: 5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
Nonce: b6hN3iT0xV5zW8yQ4mG7lO2rE9fC0kI=
OriginalSize: 450
Padding: 574
Signature: 4KqZ8jXgY5mDnR9uBbP6fT3hL8sV2wE1aG4jC7kN0xH9iM5pS6tU

jH7kD3sF6jP1aY0eU8cB5hN2iT9xV4zW7yQ3mG6lO1rE8fA9bC2dK5mN8pQ1sT4
vX7yZ0lM3nP6rU9wB8cE1fH4jL7oR0tY3aD6gK9mP2sV5xC8zF1hJ4nQ7uA0dG3
=xR5m
----- END IDENTIKEY MESSAGE -----
```

---

## Appendix: Design Rationale

### Why CRC24 Instead of CRC32?

PGP uses CRC24 (3 bytes → 4 base64 chars) as a balance between error detection and overhead. CRC32 would add an extra base64 char with marginal benefit for typical message sizes.

### Why Not Just Use PGP Format?

IdentiKey uses different crypto primitives (Ed25519/X25519, not RSA/DSA) and metadata (fingerprints, slots). Custom format avoids confusion and enables future extensions.

### Why Base58 for Keys but Base64 for Messages?

**Keys:** Base58 is standard in modern crypto (Solana, Bitcoin) - human-readable, no ambiguous chars (0/O, l/1). Keys are short (~44 chars), so efficiency isn't critical.

**Messages:** Base64 is more efficient (~33% vs ~37% overhead) and standard for email/MIME. Messages can be MB-sized, so the savings matter.

### Why Differentiate Ed25519 vs X25519 Keys?

**Ed25519:** Designed for signatures/verification (public-key auth).

**X25519:** Designed for ECDH key agreement (encryption).

Different use cases, different security properties. `KeyType` header prevents misuse (e.g., trying to encrypt with a signing key).

### Why Line Wrap at 64 Characters?

Historic standard from PGP/MIME (RFC 4880). Ensures compatibility with email systems, terminal displays (80 cols), and diff tools.

### Why Include Headers in Every Part?

Multi-part messages may be transmitted over unreliable channels. Each part being self-describing enables:

- Out-of-order receipt
- Partial verification before full download
- Independent storage/caching

### Why BLAKE2b for Chunks but CRC24 for Armor?

BLAKE2b provides cryptographic integrity (Merkle tree). CRC24 detects transmission errors (bit flips, truncation) in ASCII armor layer. Two different threat models.

---

## Revision History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0     | 2025-10-31 | Initial specification |

---

## See Also

- [RFC 4880](https://www.rfc-editor.org/rfc/rfc4880) - OpenPGP Message Format (ASCII Armor inspiration)
- [dCypher Recryption Spec](#) - Multi-part message Merkle tree details
- [IdentiKey Tech Spec Epic 2](../tech-spec-epic-2.md) - CLI tool integration

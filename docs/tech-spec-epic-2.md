# Epic Technical Specification: Developer Tools & Examples

Date: 2025-10-31
Author: Master d0rje
Epic ID: 2
Status: Draft

---

## Overview

This epic delivers developer-facing tooling to accelerate IdentiKey Tools adoption: a production-ready CLI tool with 6 commands (keygen, encrypt, decrypt, fingerprint, info, persona), plus basic and complex example applications. The CLI ships with the library package, provides Unix-friendly stdin/stdout piping, JSON output for scripting, ASCII armoring (GPG-style `-a` flag), and persona-based key management (similar to Solana CLI and AWS profiles).

Key features include default persona storage at `~/.config/identikey/` with encrypted private keys, automatic persona key resolution (no --key flag needed), ASCII armor support for text-safe ciphertext, and clear error messages. Examples demonstrate both persona-based workflows (basic) and full encryption workflow with MinIO integration (complex), giving developers copy-paste quickstarts.

Built atop the core encryption library (Epic 1), this epic focuses purely on DX (developer experience): show don't tell, code over docs, zero-config starts where possible, familiar UX patterns from established tools (Solana, AWS, GPG).

## Objectives and Scope

**In Scope:**

- CLI tool with 6 commands shipped in package bin/ (keygen, encrypt, decrypt, fingerprint, info, persona)
- Persona-based key management (default storage at `~/.config/identikey/`, similar to Solana CLI and AWS profiles)
- ASCII armoring support (`-a`/`--armor` flag, GPG-style) with auto-detection on decrypt
- Encrypted private key storage with passphrase protection
- Stdin/stdout piping for Unix-style composition
- JSON output mode (`--json` flag) for scripting
- Progress indicators for large file operations
- Automatic persona key resolution (commands work without --key flag)
- Basic example app (examples/basic/): persona creation, keypair generation, persona switching
- Complex example app (examples/complex/): full encrypt→store→retrieve→decrypt with MinIO
- READMEs with copy-paste quickstarts for each example
- CI tests validating CLI commands + example smoke tests

**Out of Scope:**

- Web UI or graphical interfaces (CLI-only)
- Package manager integrations beyond npm/bun install
- Multi-recipient encryption examples (covered in Epic 1 core lib)
- Production deployment guides for CLI (examples show patterns, not ops)
- Hardware security module (HSM) integration for key storage
- Multi-device persona sync (each device has isolated personas)

## System Architecture Alignment

Builds on content-addressable encrypted storage architecture (Epic 1). CLI wraps `EncryptedStorage` API, examples demonstrate usage patterns. No new architectural components—pure consumer layer.

**Constraints from Architecture:**

- Must use TweetNaCl keypairs (Curve25519)
- Storage backend must be pluggable (MinIO default, filesystem fallback for basic example)
- CBOR header format is fixed (version byte + fingerprint + metadata)
- Content addressing via SHA-256 hashes

**Component References:**

- `src/api/encrypted-storage.ts` - Main API consumed by CLI
- `src/keypair.ts` - Key generation consumed by CLI keygen command
- `src/header/fingerprint.ts` - Used by CLI fingerprint command
- `src/storage/minio-adapter.ts` - Used by complex example

## Detailed Design

### Services and Modules

| Module                              | Responsibility                                            | Inputs                                      | Outputs                           | Owner     |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------- | --------------------------------- | --------- |
| `src/cli/index.ts`                  | CLI entry point, command router                           | argv                                        | exit code                         | Story 2-1 |
| `src/cli/commands/keygen.ts`        | Generate keypair, save to config dir or custom path       | --output path, --persona name, --armor flag | keypair files                     | Story 2-1 |
| `src/cli/commands/encrypt.ts`       | Encrypt stdin/file to stdout with optional ASCII armoring | plaintext, pubkey, --armor                  | ciphertext (raw or ASCII-armored) | Story 2-1 |
| `src/cli/commands/decrypt.ts`       | Decrypt stdin/file to stdout, auto-detect armor           | ciphertext (raw or ASCII-armored), privkey  | plaintext                         | Story 2-1 |
| `src/cli/commands/fingerprint.ts`   | Show pubkey fingerprint                                   | pubkey file                                 | hex fingerprint                   | Story 2-1 |
| `src/cli/commands/info.ts`          | Parse blob header, show metadata                          | encrypted blob                              | metadata JSON                     | Story 2-1 |
| `src/cli/commands/persona.ts`       | Switch active persona, list personas                      | --list or persona name                      | active persona name               | Story 2-1 |
| `src/cli/utils/persona-manager.ts`  | Manage persona configs (like AWS profiles)                | config dir                                  | persona metadata                  | Story 2-1 |
| `src/cli/utils/armor.ts`            | ASCII armor/dearmor binary data (GPG-style)               | binary data                                 | ASCII-armored text                | Story 2-1 |
| `examples/basic/01-keygen.ts`       | Demo script: generate keypair                             | none                                        | keypair files                     | Story 2-2 |
| `examples/basic/02-inspect.ts`      | Demo script: load keypair, show info                      | keypair files                               | console output                    | Story 2-2 |
| `examples/complex/full-workflow.ts` | Demo script: E2E encryption workflow                      | plaintext, MinIO config                     | retrieved plaintext               | Story 2-3 |
| `examples/complex/batch-encrypt.ts` | Demo script: batch file encryption                        | directory                                   | encrypted blobs                   | Story 2-3 |
| `examples/complex/key-rotation.ts`  | Demo script: re-encrypt with new key                      | old privkey, new pubkey                     | re-encrypted blobs                | Story 2-3 |

### Data Models and Contracts

**CLI Argument Schemas:**

```typescript
// keygen command
interface KeygenArgs {
  output?: string; // custom path, overrides default persona location
  persona?: string; // persona name, default: "default"
  armor?: boolean; // -a/--armor: ASCII armor output
}

// encrypt command
interface EncryptArgs {
  input?: string; // default: stdin
  key?: string; // path to pubkey, optional if using active persona
  output?: string; // default: stdout
  armor?: boolean; // -a/--armor: ASCII armor output
}

// decrypt command
interface DecryptArgs {
  input?: string; // default: stdin
  key?: string; // path to privkey, optional if using active persona
  output?: string; // default: stdout
  // Note: Auto-detects ASCII armor, no flag needed
}

// fingerprint command
interface FingerprintArgs {
  key?: string; // path to pubkey, optional if using active persona
  json?: boolean; // default: false
}

// info command
interface InfoArgs {
  blob: string; // required: path to encrypted blob
  json?: boolean; // default: false
}

// persona command
interface PersonaArgs {
  list?: boolean; // --list: show all personas
  name?: string; // persona name to switch to
}
```

**Persona and Configuration Models:**

```typescript
// ~/.config/identikey/config.json
interface IdentikeyConfig {
  activePersona: string; // current active persona name
  personas: Record<string, PersonaConfig>;
}

interface PersonaConfig {
  name: string;
  keyPath: string; // path to encrypted private key (default: ~/.config/identikey/personas/{name}/id.json)
  publicKeyPath: string; // path to public key
  createdAt: string; // ISO timestamp
  fingerprint: string; // public key fingerprint for quick lookup
}

// Encrypted key file format (~/.config/identikey/personas/{name}/id.json)
interface EncryptedKeyFile {
  version: number; // format version, start at 1
  publicKey: string; // ASCII-armored or base58
  privateKey: string; // encrypted with user passphrase, ASCII-armored
  salt: string; // for key derivation
  nonce: string; // encryption nonce
  fingerprint: string; // public key fingerprint
}
```

**ASCII Armor Format:**

```typescript
// NOTE: Consult user about ASCII armoring format from other repository
// Preferences and design decisions needed before implementation
//
// Expected format (similar to GPG):
// -----BEGIN IDENTIKEY ENCRYPTED MESSAGE-----
// Version: 1
//
// base64EncodedData...
// =checksum
// -----END IDENTIKEY ENCRYPTED MESSAGE-----

interface ArmorOptions {
  type: "ENCRYPTED MESSAGE" | "PUBLIC KEY" | "PRIVATE KEY";
  data: Buffer;
  version?: number;
}
```

**Example Configurations:**

```typescript
// examples/complex/config.ts
interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}
```

**Key Design Decisions:**

- Default key storage: `~/.config/identikey/personas/{persona-name}/id.json` (encrypted, similar to Solana CLI at `~/.config/solana/id.json`)
- Persona switching: Like AWS CLI profiles, each persona has isolated keys
- Private keys encrypted at rest with user passphrase
- ASCII armoring: GPG-style with `-a`/`--armor` flag, format TBD with user consultation

### APIs and Interfaces

**CLI Commands (user-facing):**

```bash
# keygen: Generate keypair (stored in config dir by default, like Solana CLI)
identikey keygen [--persona <name>] [--output <path>] [-a|--armor]
# Default: Creates ~/.config/identikey/personas/default/id.json (encrypted)
# With --persona: Creates ~/.config/identikey/personas/<name>/id.json
# With --output: Saves to custom path instead
# With --armor: Outputs ASCII-armored format

# persona: Manage personas (like AWS CLI profiles)
identikey persona list                    # List all personas
identikey persona <name>                  # Switch active persona
identikey persona current                 # Show current active persona
# Example: Switch to "work" persona
identikey persona work
# All subsequent commands use ~/.config/identikey/personas/work/id.json

# encrypt: Encrypt file or stdin
identikey encrypt <input> [--key <pubkey>] [--output <file>] [-a|--armor]
cat plaintext.txt | identikey encrypt -a > encrypted.txt  # ASCII-armored
echo "secret" | identikey encrypt --key pub.pem > secret.bin  # Raw binary
identikey encrypt --key pub.pem --armor < data.txt > data.enc  # Explicit key + armor

# decrypt: Decrypt file or stdin (auto-detects ASCII armor)
identikey decrypt <input> [--key <privkey>] [--output <file>]
cat encrypted.txt | identikey decrypt  # Uses active persona key, auto-detects armor
cat secret.bin | identikey decrypt --key priv.pem  # Explicit key

# fingerprint: Show pubkey fingerprint
identikey fingerprint [--key <pubkey>] [--json]
identikey fingerprint  # Uses active persona pubkey
identikey fingerprint --key ./pub.pem  # Explicit key
# Output: a1b2c3d4... (hex string)

# info: Show blob metadata without decrypting
identikey info <encrypted-blob> [--json]
# Output: version, key_fingerprint, created_at, etc.
```

**Key UX Patterns:**

1. **Default Persona Flow (like Solana):**

   ```bash
   identikey keygen  # Creates default persona at ~/.config/identikey/personas/default/
   identikey encrypt < secret.txt > secret.enc  # Uses default persona automatically
   identikey decrypt < secret.enc  # Uses default persona automatically
   ```

2. **Multi-Persona Flow (like AWS profiles):**

   ```bash
   identikey keygen --persona personal
   identikey keygen --persona work
   identikey persona list  # Shows: personal, work (active: personal)
   identikey persona work  # Switch to work
   identikey encrypt < confidential.txt > confidential.enc  # Uses work persona
   ```

3. **Explicit Key Flow (legacy/advanced):**

   ```bash
   identikey keygen --output ./keys/  # Custom location
   identikey encrypt --key ./keys/pub.pem < data.txt > data.enc
   identikey decrypt --key ./keys/priv.pem < data.enc
   ```

4. **ASCII Armor Flow (like GPG -a):**
   ```bash
   identikey keygen -a  # ASCII-armored keys
   identikey encrypt -a < plaintext.txt > ciphertext.txt  # Text-safe output
   cat ciphertext.txt  # Human-readable (base64-ish)
   identikey decrypt < ciphertext.txt  # Auto-detects armor
   ```

**Error Codes:**

- `0` - Success
- `1` - Invalid arguments
- `2` - File not found
- `3` - Decryption failed
- `4` - Storage backend error

**Internal CLI Utilities (module interfaces):**

```typescript
// src/cli/utils/file-io.ts
export function readStdinOrFile(path?: string): Promise<Buffer>;
export function writeStdoutOrFile(data: Buffer, path?: string): Promise<void>;

// src/cli/utils/output-formatter.ts
export function formatJSON(obj: unknown): string;
export function formatTable(rows: Array<[string, string]>): string;

// src/cli/utils/args-parser.ts
export function parseArgs<T>(schema: ZodSchema<T>): T;

// src/cli/utils/persona-manager.ts
export class PersonaManager {
  constructor(configDir: string); // default: ~/.config/identikey
  listPersonas(): PersonaConfig[];
  getActivePersona(): PersonaConfig;
  setActivePersona(name: string): void;
  createPersona(name: string, keyPath: string): void;
  deletePersona(name: string): void;
  getPersonaKeyPath(name?: string): string; // returns path to active or specified persona key
}

// src/cli/utils/armor.ts
// NOTE: ASCII armor format requires user consultation (see Open Questions)
export function armor(data: Buffer, type: ArmorType): string;
export function dearmor(armoredText: string): { data: Buffer; type: ArmorType };
export function isArmored(input: Buffer | string): boolean; // Auto-detect armor

type ArmorType = "ENCRYPTED MESSAGE" | "PUBLIC KEY" | "PRIVATE KEY";

// src/cli/utils/key-encryption.ts
export function encryptPrivateKey(
  privateKey: Buffer,
  passphrase: string
): EncryptedKeyFile;
export function decryptPrivateKey(
  encryptedKey: EncryptedKeyFile,
  passphrase: string
): Buffer;
```

### Workflows and Sequencing

**CLI Keygen Sequence (with persona support):**

```
1. Parse args (persona, output, armor)
2. If no --output: Use ~/.config/identikey/personas/{persona}/id.json
3. Generate keypair via core lib
4. Prompt user for passphrase (if storing in config dir)
5. Encrypt private key with passphrase
6. If --armor: ASCII armor keys before saving
7. Save EncryptedKeyFile to persona location
8. Update ~/.config/identikey/config.json with new persona
9. Display fingerprint + persona info
10. Exit 0
```

**CLI Persona Switch Sequence:**

```
1. Parse args (persona name or --list)
2. Load PersonaManager from ~/.config/identikey/config.json
3. If --list: Display all personas + active marker
4. Else: Verify persona exists
5. Update activePersona in config.json
6. Display "Switched to persona: {name}"
7. Exit 0
```

**CLI Encrypt Sequence (with persona and armor):**

```
1. Parse args (input, key, output, armor)
2. If --key provided: Read pubkey from file
3. Else: Get active persona pubkey via PersonaManager
4. Read plaintext from input (file or stdin)
5. Call EncryptedStorage.encrypt(plaintext, pubkey)
6. If --armor: ASCII armor ciphertext
7. Write ciphertext to output (file or stdout)
8. Exit 0
```

**CLI Decrypt Sequence (with auto-armor detection):**

```
1. Parse args (input, key, output)
2. Read ciphertext from input (file or stdin)
3. If isArmored(ciphertext): Dearmor first
4. If --key provided: Read privkey from file
5. Else: Get active persona privkey via PersonaManager, prompt for passphrase
6. Call EncryptedStorage.decrypt(ciphertext, privkey)
7. Write plaintext to output (file or stdout)
8. Exit 0
```

**Complex Example Workflow (full-workflow.ts):**

```
1. Generate keypair via core lib (or use persona)
2. Create plaintext file
3. Encrypt plaintext → get content hash
4. Upload encrypted blob to MinIO via EncryptedStorage.put()
5. Retrieve blob from MinIO via EncryptedStorage.get(hash)
6. Decrypt retrieved blob
7. Verify plaintext matches original
8. Display metrics (time, size, hash)
```

**Basic Example Workflow (01-keygen.ts):**

```
1. Call generateKeyPair() from core lib
2. Demonstrate both custom path and persona-based storage
3. Show persona switching
4. Calculate fingerprint
5. Display success + fingerprint
```

## Non-Functional Requirements

### Performance

- **CLI Startup:** < 100ms for command parsing (measured with `time identikey --help`)
- **Basic Example Runtime:** < 1 second for keygen example (zero deps means fast load)
- **Complex Example Runtime:** < 5 seconds for full-workflow.ts (includes MinIO network roundtrip)
- **Large File Encryption:** Show progress every 10% for files > 10MB
- **Piping Throughput:** Must handle stdin/stdout at line speed (no buffering bottlenecks)

**Source:** Epic overview success criteria

### Security

- **Key File Permissions:** keygen command must set privkey file to 0600 (owner-only read/write)
- **No Plaintext Leakage:** Error messages must not echo plaintext or keys
- **Secure Defaults:** All examples must use proper key handling (no hardcoded keys)
- **Dependency Audit:** Commander.js, Chalk, Ora must pass `bun audit` (no critical CVEs)

**Source:** Architecture security principles

### Reliability/Availability

- **Error Handling:** All CLI commands must catch exceptions and return actionable error messages
- **Graceful Degradation:** If MinIO unavailable, complex example should error clearly (not hang)
- **Cross-Platform:** CLI must work on macOS, Linux, Windows (test shebang compatibility)
- **Stdin/Stdout Edge Cases:** Must handle broken pipes, binary data, large files (>1GB)

**Source:** Epic risk mitigation table

### Observability

- **Progress Indicators:** Large file operations must show progress bar (Ora library)
- **JSON Output:** All commands support `--json` flag for machine-readable output
- **Error Messages:** Must include actionable hints (e.g., "File not found: did you forget --key?")
- **Example Metrics:** Complex example scripts must log timing and size metrics

**Source:** Epic overview DX focus

## Dependencies and Integrations

**External Dependencies (package.json additions):**

```json
{
  "dependencies": {
    "commander": "^12.0.0", // CLI framework
    "chalk": "^5.3.0", // Terminal colors
    "ora": "^8.0.1", // Progress spinners
    "cli-table3": "^0.6.5" // Table formatting
  }
}
```

**Internal Dependencies:**

- `@identikey/tools` - Core encryption library (Epic 1)
  - `EncryptedStorage` API
  - `generateKeyPair()` function
  - `fingerprint()` utility
  - `parseHeader()` for info command

**Infrastructure Dependencies:**

- MinIO instance (user-provided, complex example only)
- Node.js/Bun runtime (>= v20 for ESM support)

**Current Dependencies (from package.json):**

- `tweetnacl: ^1.0.3` (crypto primitives)
- `cbor: ^10.0.11` (header serialization)
- `minio: ^8.0.6` (storage backend)
- `zod: ^4.1.12` (validation)
- `bs58: ^6.0.0` (encoding)

## Acceptance Criteria (Authoritative)

1. **CLI Installable:** `bun install -g @identikey/tools` makes `identikey` command available globally
2. **6 Commands Functional:** keygen, encrypt, decrypt, fingerprint, info, persona all execute successfully
3. **Default Persona Storage:** `identikey keygen` creates encrypted key at `~/.config/identikey/personas/default/id.json` (like Solana CLI)
4. **Persona Switching:** `identikey persona work` switches active persona, subsequent commands use work persona keys automatically
5. **ASCII Armor Support:** `identikey encrypt -a` outputs text-safe ASCII-armored ciphertext, `identikey decrypt` auto-detects and handles armored input
6. **Stdin/Stdout Piping:** `cat file | identikey encrypt --key pub.pem | identikey decrypt --key priv.pem` roundtrips correctly
7. **Persona-Based Encryption:** `identikey encrypt < secret.txt` uses active persona pubkey without --key flag
8. **JSON Output:** `identikey info blob.enc --json` outputs valid JSON (parseable by `jq`)
9. **Basic Example Zero Config:** `bun run examples/basic/01-keygen.ts` succeeds with no setup, demonstrates persona usage
10. **Complex Example Full Workflow:** `bun run examples/complex/full-workflow.ts` completes E2E cycle
11. **Progress Indicators:** Encrypting 50MB file shows progress bar with percentage
12. **Error Messages Clear:** Missing --key flag shows "Error: --key required or use active persona. Run 'identikey keygen' first."
13. **READMEs Present:** examples/basic/README.md and examples/complex/README.md exist with quickstarts
14. **CI Tests Pass:** All CLI commands + examples validated in GitHub Actions workflow

## Traceability Mapping

| AC # | Spec Section                                  | Component/API                                  | Test Idea                                                               |
| ---- | --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | Dependencies → package.json bin field         | bin/identikey                                  | Install in tmp dir, run `which identikey`                               |
| 2    | APIs → CLI Commands                           | src/cli/commands/\*.ts                         | Unit test each command with mocked I/O                                  |
| 3    | Data Models → PersonaConfig, EncryptedKeyFile | src/cli/commands/keygen.ts, persona-manager.ts | Integration test: keygen creates config dir + persona file              |
| 4    | Workflows → Persona Switch Sequence           | src/cli/commands/persona.ts                    | Unit test: switch persona, verify config.json activePersona updated     |
| 5    | Data Models → ArmorOptions                    | src/cli/utils/armor.ts                         | Unit test: armor/dearmor roundtrip, isArmored() detection               |
| 6    | Workflows → CLI Encrypt/Decrypt Sequence      | src/cli/commands/encrypt.ts, decrypt.ts        | Integration test: echo "test" \| encrypt \| decrypt                     |
| 7    | Workflows → Persona-based encryption          | src/cli/commands/encrypt.ts + PersonaManager   | Integration test: encrypt without --key uses active persona             |
| 8    | APIs → info command --json                    | src/cli/commands/info.ts                       | Unit test: info --json \| jq .version                                   |
| 9    | Workflows → Basic Example                     | examples/basic/01-keygen.ts                    | Smoke test: run script, verify persona created                          |
| 10   | Workflows → Complex Example                   | examples/complex/full-workflow.ts              | E2E test: run against MinIO, verify plaintext match                     |
| 11   | NFR Performance → progress                    | src/cli/utils/progress.ts (Ora wrapper)        | Manual test: encrypt 50MB file, observe output                          |
| 12   | NFR Observability → error messages            | src/cli/commands/\*.ts error handlers          | Unit test: call encrypt without --key and no persona, assert error text |
| 13   | Overview → READMEs                            | examples/\*/README.md                          | Lint test: verify files exist, have ## Quick Start section              |
| 14   | Overview → CI tests                           | .github/workflows/ci.yml                       | CI config: add `bun run test:cli` job                                   |

## Risks, Assumptions, Open Questions

**Risks:**

1. **Risk [HIGH]:** ASCII armor format specification not finalized before Story 2-1 Day 1

   - **Impact:** Blocks armor.ts implementation, delays encrypt/decrypt --armor flag
   - **Mitigation:** Schedule user consultation immediately, have fallback (use standard PEM/base64 if custom format unavailable)

2. **Risk:** Passphrase KDF choice impacts UX (Argon2 slow on low-end devices, PBKDF2 less secure)

   - **Mitigation:** Benchmark on target platforms, make configurable with sane defaults

3. **Risk:** Stdin/stdout binary data handling breaks on Windows (encoding issues)

   - **Mitigation:** Test early on Windows, use Buffer.from() not string concat, provide .cmd wrapper if needed

4. **Risk:** Commander.js learning curve delays Story 2-1

   - **Mitigation:** Prototype keygen command Day 1, reference existing CLIs (aws-cli, openssl)

5. **Risk:** Example API mismatch (examples call deprecated core lib methods)

   - **Mitigation:** Pin examples to specific lib version, CI validates examples run

6. **Risk:** Cross-platform shebang issues (#!/usr/bin/env node doesn't work on Windows)

   - **Mitigation:** Test on all platforms, provide .cmd launcher script

7. **Risk:** Persona config file conflicts (concurrent writes, lock files)
   - **Mitigation:** Use atomic writes (write to temp, rename), add file locking if needed

**Assumptions:**

1. **Assumption:** Developers prefer CLI examples over web UI demos

   - **Justification:** Epic focus is "show code, not UI" for crypto library adoption

2. **Assumption:** MinIO is already running in user's infra for complex example

   - **Justification:** Epic scope says "user's infra, already set up" + provide setup script

3. **Assumption:** Bun runtime is acceptable (not just Node.js)
   - **Justification:** Project uses Bun (see package.json scripts), examples can too

**Open Questions:**

1. **Question [CRITICAL]:** ASCII Armor Format Specification

   - **Details:** User has ASCII armor design in another repository. Need to consult on:
     - Exact format specification (headers, base64 variant, checksum algorithm)
     - Compatibility with existing systems (GPG, PEM, custom?)
     - Block size and line wrapping preferences
     - Metadata inclusion (version, key fingerprint in armor headers?)
   - **Answer Needed By:** Story 2-1 Day 1 (before implementing armor.ts utility)
   - **Stakeholder:** Master d0rje
   - **Blocker:** Yes - armor.ts implementation depends on this

2. **Question:** Should CLI support --verbose flag for debug logging?

   - **Answer Needed By:** Story 2-1 Day 2 (encrypt/decrypt implementation)
   - **Stakeholder:** Dev team (decide based on debugging needs)

3. **Question:** Passphrase encryption algorithm for stored private keys?

   - **Details:** Which KDF for passphrase → key derivation? (Argon2, scrypt, PBKDF2?)
   - **Answer Needed By:** Story 2-1 Day 1 (key-encryption.ts implementation)
   - **Stakeholder:** Master d0rje (security vs. performance trade-off)

4. **Question:** Should examples/complex include Dockerfile for MinIO setup?

   - **Answer Needed By:** Story 2-3 Day 6 (setup script)
   - **Stakeholder:** Master d0rje (decide based on DX priorities)

5. **Question:** Do we need Windows .cmd wrapper or is WSL sufficient?
   - **Answer Needed By:** Story 2-1 Day 3 (cross-platform testing)
   - **Stakeholder:** QA/Testing (depends on user platform analytics)

## Test Strategy Summary

**Unit Tests (Jest/Bun Test):**

- Each CLI command (keygen, encrypt, decrypt, fingerprint, info, persona) tested in isolation
- PersonaManager tests: create, switch, list, delete personas
- ASCII armor tests: armor/dearmor roundtrip, auto-detection, invalid input
- Key encryption tests: passphrase encryption/decryption, wrong passphrase handling
- Mock file I/O (stdin/stdout/files) using test fixtures
- Validate argument parsing edge cases (missing --key, invalid paths, --armor combos)
- Coverage target: >90% for src/cli/ directory

**Integration Tests:**

- Full piping workflow: `echo "test" | encrypt | decrypt` (in-memory)
- Persona workflow: `keygen --persona test`, switch, encrypt/decrypt with persona keys
- ASCII armor workflow: `encrypt -a | decrypt` roundtrip with text-safe output
- CLI → core lib integration (actual EncryptedStorage calls, not mocked)
- File I/O roundtrips (write to tmpdir, read back, verify)
- Config file persistence: Verify ~/.config/identikey/config.json updates correctly
- Coverage: All 6 commands tested with real file operations

**E2E Tests:**

- Complex example full-workflow.ts runs against MinIO testcontainer
- Basic example smoke test: run 01-keygen.ts, verify keys/ folder
- Complex example smoke test: run all 4 scripts, assert exit 0
- Coverage: All example scripts executed in CI

**Manual Tests:**

- Cross-platform: Run CLI on macOS, Linux, Windows WSL
- Large files: Encrypt 1GB file, verify progress indicators
- UX validation: Test error messages with real users (5-10 devs)
- Coverage: NFR observability + performance targets

**CI Pipeline:**

- GitHub Actions job: `test:cli`
  - Install CLI globally: `bun install -g .`
  - Run unit tests: `bun test src/cli/`
  - Run example smoke tests: `bun run examples/basic/*.ts`
  - Run E2E tests: `bun test tests/cli/`
- MinIO service container for complex example tests
- Platform matrix: [ubuntu-latest, macos-latest, windows-latest]

**Test Data:**

- Fixtures: examples/test-fixtures/ (sample plaintexts, keypairs)
- Generated: Use faker.js for random data in unit tests
- Edge cases: Empty file, 1GB file, binary data, UTF-8 with emojis

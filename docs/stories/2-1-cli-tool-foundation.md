# Story 2.1: CLI Tool Foundation

Status: ready-for-dev

## Story

As a **developer integrating IdentiKey Tools**,
I want **a production-ready CLI tool with 6 commands (keygen, encrypt, decrypt, fingerprint, info, persona) supporting persona-based key management, ASCII armoring, and stdin/stdout piping**,
so that **I can quickly test encryption workflows, manage multiple key personas, and integrate the library into scripts without writing custom code**.

## Acceptance Criteria

1. **CLI Installable:** `bun install -g @identikey/tools` makes `identikey` command available globally
2. **6 Commands Functional:** keygen, encrypt, decrypt, fingerprint, info, persona all execute successfully
3. **Default Persona Storage:** `identikey keygen` creates encrypted key at `~/.config/identikey/personas/default/id.json` (like Solana CLI)
4. **Persona Switching:** `identikey persona work` switches active persona, subsequent commands use work persona keys automatically
5. **ASCII Armor Support:** `identikey encrypt -a` outputs text-safe ASCII-armored ciphertext, `identikey decrypt` auto-detects and handles armored input
6. **Stdin/Stdout Piping:** `cat file | identikey encrypt --key pub.pem | identikey decrypt --key priv.pem` roundtrips correctly
7. **Persona-Based Encryption:** `identikey encrypt < secret.txt` uses active persona pubkey without --key flag
8. **JSON Output:** `identikey info blob.enc --json` outputs valid JSON (parseable by `jq`)
9. **Progress Indicators:** Encrypting 50MB file shows progress bar with percentage
10. **Error Messages Clear:** Missing --key flag shows "Error: --key required or use active persona. Run 'identikey keygen' first."
11. **All tests pass:** Unit tests for each command + integration tests for piping + persona workflows

[Source: docs/tech-spec-epic-2.md#Acceptance-Criteria]

## Tasks / Subtasks

### Phase 1: Project Setup and CLI Scaffolding (AC: 1)

- [ ] Task 1.1: Install Commander.js, Chalk, Ora, CLI-Table3 dependencies (AC: 1)

  - [ ] Add `commander@^12.0.0`, `chalk@^5.3.0`, `ora@^8.0.1`, `cli-table3@^0.6.5` to package.json
  - [ ] Update package.json with `bin` field pointing to `bin/identikey`
  - [ ] Create `bin/identikey` shebang script with `#!/usr/bin/env node`
  - [ ] Verify global install works: `bun install -g .` + `which identikey`

- [ ] Task 1.2: Create CLI entry point and command router (AC: 1, 2)
  - [ ] Create `src/cli/index.ts` with Commander.js program setup
  - [ ] Register 6 command placeholders: keygen, encrypt, decrypt, fingerprint, info, persona
  - [ ] Add global error handler for uncaught exceptions
  - [ ] Verify CLI responds to `identikey --help`

### Phase 2: Persona Management System (AC: 3, 4, 7)

- [ ] Task 2.1: Implement PersonaManager utility (AC: 3, 4)

  - [ ] Create `src/cli/utils/persona-manager.ts` with PersonaManager class
  - [ ] Implement `listPersonas()`, `getActivePersona()`, `setActivePersona()`, `createPersona()`, `deletePersona()`
  - [ ] Implement config file persistence at `~/.config/identikey/config.json`
  - [ ] Add atomic write (write to temp, rename) to prevent config corruption
  - [ ] Unit tests: create persona, switch, list, config file structure

- [ ] Task 2.2: Implement passphrase-based key encryption (AC: 3)
  - [ ] Create `src/cli/utils/key-encryption.ts` with `encryptPrivateKey()`, `decryptPrivateKey()`
  - [ ] Use Argon2id KDF (64MB memory, 3 iterations, parallelism=1) - NOTE: Install `@noble/hashes` or similar for Argon2id
  - [ ] Generate cryptographically random salt (16 bytes) and nonce (24 bytes)
  - [ ] Encrypt private key with XSalsa20-Poly1305 using derived key
  - [ ] Return `EncryptedKeyFile` format: {version, publicKey, privateKey, salt, nonce, fingerprint}
  - [ ] Unit tests: encrypt/decrypt roundtrip, wrong passphrase fails, salt/nonce uniqueness

### Phase 3: ASCII Armoring (AC: 5)

- [ ] Task 3.1: Implement ASCII armor utility (AC: 5)
  - [ ] Create `src/cli/utils/armor.ts` with `armor()`, `dearmor()`, `isArmored()` functions
  - [ ] Implement armor format per `docs/architecture/ascii-armoring-spec.md`:
    - Public/Private keys: Base58 encoding with CRC24 checksum
    - Messages: Base64 encoding (wrapped at 64 chars) with CRC24 checksum
    - Headers: Version, KeyType/RecipientFingerprint, metadata
    - Delimiters: `----- BEGIN/END IDENTIKEY <TYPE> -----`
  - [ ] Implement CRC24 algorithm (polynomial 0x864CFB, init 0xb704ce)
  - [ ] Auto-detection: Check for `----- BEGIN IDENTIKEY` prefix
  - [ ] Unit tests: armor/dearmor roundtrip for keys + messages, CRC24 validation, isArmored() detection
  - [ ] Edge cases: invalid armor format, CRC mismatch, malformed Base58/Base64

[Source: docs/architecture/ascii-armoring-spec.md]

### Phase 4: Keygen Command (AC: 3, 4, 5)

- [ ] Task 4.1: Implement keygen command (AC: 3, 4, 5)
  - [ ] Create `src/cli/commands/keygen.ts`
  - [ ] Parse args: `--output <path>`, `--persona <name>`, `-a/--armor`
  - [ ] Default behavior: Create `~/.config/identikey/personas/default/id.json` if no args
  - [ ] Generate keypair via `generateKeyPair()` from `src/keypair.ts`
  - [ ] Prompt user for passphrase (use `ora` or similar for masked input)
  - [ ] Encrypt private key with passphrase using `encryptPrivateKey()`
  - [ ] If `--armor`: ASCII armor keys before saving
  - [ ] Save `EncryptedKeyFile` to persona location
  - [ ] Update config.json with new persona via PersonaManager
  - [ ] Display fingerprint + persona info on success
  - [ ] Integration tests: keygen creates config dir, keygen with --persona, keygen with --output custom path, keygen with --armor

### Phase 5: Persona Command (AC: 4)

- [ ] Task 5.1: Implement persona command (AC: 4)
  - [ ] Create `src/cli/commands/persona.ts`
  - [ ] Parse args: `list` or `<persona-name>`
  - [ ] `persona list`: Display all personas with active marker (use cli-table3 for formatting)
  - [ ] `persona <name>`: Switch active persona via PersonaManager
  - [ ] `persona current`: Show current active persona
  - [ ] Error handling: persona not found, no personas exist
  - [ ] Unit tests: switch persona, list personas, current persona

### Phase 6: Fingerprint Command (AC: 8)

- [ ] Task 6.1: Implement fingerprint command (AC: 8)
  - [ ] Create `src/cli/commands/fingerprint.ts`
  - [ ] Parse args: `--key <path>` (optional if using persona), `--json`
  - [ ] If no `--key`: Get active persona pubkey via PersonaManager
  - [ ] Load key, check if armored (auto-dearmor if needed)
  - [ ] Call `fingerprint()` from `src/header/fingerprint.ts`
  - [ ] If `--json`: Output `{"fingerprint": "abc123...", "keyType": "Ed25519"}`
  - [ ] Else: Output hex string directly
  - [ ] Unit tests: fingerprint with persona, fingerprint with --key, --json output, armored key handling

### Phase 7: Encrypt Command (AC: 5, 6, 7, 9)

- [ ] Task 7.1: Implement encrypt command (AC: 5, 6, 7, 9)

  - [ ] Create `src/cli/commands/encrypt.ts`
  - [ ] Parse args: `<input>` (default stdin), `--key <pubkey>` (optional), `--output <file>` (default stdout), `-a/--armor`
  - [ ] If no `--key`: Get active persona pubkey via PersonaManager
  - [ ] Read pubkey, check if armored (auto-dearmor if needed)
  - [ ] Read plaintext from stdin or file (use `readStdinOrFile()` utility)
  - [ ] If file > 10MB: Show progress bar with Ora (update every 10%)
  - [ ] Call `EncryptedStorage.encrypt(plaintext, pubkey)` from core lib
  - [ ] If `--armor`: ASCII armor ciphertext using `armor(data, 'ENCRYPTED MESSAGE')`
  - [ ] Write ciphertext to stdout or file (use `writeStdoutOrFile()` utility)
  - [ ] Error handling: missing key, file not found, encryption failed
  - [ ] Integration tests: encrypt stdin, encrypt file, encrypt with --armor, encrypt with persona, progress bar for large file

- [ ] Task 7.2: Implement file I/O utilities
  - [ ] Create `src/cli/utils/file-io.ts` with `readStdinOrFile()`, `writeStdoutOrFile()`
  - [ ] Handle stdin detection (check if `process.stdin.isTTY`)
  - [ ] Handle binary data correctly (use Buffer, not string)
  - [ ] Handle broken pipes gracefully
  - [ ] Unit tests: read from stdin, read from file, write to stdout, write to file

### Phase 8: Decrypt Command (AC: 5, 6, 10)

- [ ] Task 8.1: Implement decrypt command (AC: 5, 6, 10)
  - [ ] Create `src/cli/commands/decrypt.ts`
  - [ ] Parse args: `<input>` (default stdin), `--key <privkey>` (optional), `--output <file>` (default stdout)
  - [ ] Read ciphertext from stdin or file
  - [ ] Auto-detect armor: If `isArmored(ciphertext)`, dearmor first
  - [ ] If no `--key`: Get active persona privkey via PersonaManager, prompt for passphrase, decrypt key
  - [ ] Read privkey, check if armored (auto-dearmor if needed)
  - [ ] Call `EncryptedStorage.decrypt(ciphertext, privkey)` from core lib
  - [ ] Write plaintext to stdout or file
  - [ ] Error handling: missing key, decryption failed (clear message per AC10), wrong passphrase
  - [ ] Integration tests: decrypt stdin, decrypt file, decrypt armored, decrypt with persona, roundtrip with encrypt

### Phase 9: Info Command (AC: 8)

- [ ] Task 9.1: Implement info command (AC: 8)
  - [ ] Create `src/cli/commands/info.ts`
  - [ ] Parse args: `<blob>` (required), `--json`
  - [ ] Read encrypted blob from file
  - [ ] Check if armored, dearmor if needed
  - [ ] Call `parseHeader()` from `src/header/parse.ts`
  - [ ] Extract: version, key_fingerprint, metadata (created_at, etc.)
  - [ ] If `--json`: Output structured JSON (parseable by jq)
  - [ ] Else: Display human-readable table (use cli-table3)
  - [ ] Error handling: file not found, invalid header format
  - [ ] Unit tests: info with raw blob, info with armored blob, --json output, invalid input

### Phase 10: Error Handling and Output Formatting (AC: 10)

- [ ] Task 10.1: Implement error messages and output utilities (AC: 10)
  - [ ] Create `src/cli/utils/output-formatter.ts` with `formatJSON()`, `formatTable()`, `formatError()`
  - [ ] Create `src/cli/utils/error-handler.ts` with friendly error messages
  - [ ] Map common errors to actionable messages:
    - No --key + no persona: "Error: --key required or use active persona. Run 'identikey keygen' first."
    - File not found: "Error: File not found: <path>. Check the path and try again."
    - Decryption failed: "Error: Decryption failed. Wrong key or corrupted ciphertext."
  - [ ] Add global error handler to CLI index to catch and format all errors
  - [ ] Unit tests: error message formatting, error handler coverage

### Phase 11: Testing and CI Integration (AC: 11)

- [ ] Task 11.1: Unit tests for all commands (AC: 11)

  - [ ] Test keygen: creates persona, config file, encrypted key file, --armor flag
  - [ ] Test persona: switch, list, current
  - [ ] Test encrypt: stdin, file, persona, --armor, progress
  - [ ] Test decrypt: stdin, file, persona, auto-dearmor
  - [ ] Test fingerprint: persona, --key, --json
  - [ ] Test info: raw blob, armored blob, --json
  - [ ] Mock file I/O (use test fixtures)
  - [ ] Target: >90% coverage for src/cli/

- [ ] Task 11.2: Integration tests for workflows (AC: 6, 7, 11)

  - [ ] Test stdin/stdout piping: `echo "test" | identikey encrypt | identikey decrypt`
  - [ ] Test persona workflow: keygen --persona test, switch, encrypt/decrypt
  - [ ] Test ASCII armor workflow: encrypt -a | decrypt
  - [ ] Test config file persistence: verify ~/.config/identikey/config.json updates
  - [ ] Run against real file system (use temp directories)
  - [ ] Target: All 6 commands tested with real I/O

- [ ] Task 11.3: Update CI pipeline (AC: 11)
  - [ ] Add `test:cli` script to package.json: `bun test src/cli/ tests/cli/`
  - [ ] Update `.github/workflows/ci.yml` to run CLI tests in separate job
  - [ ] Verify CLI installable globally in CI: `bun install -g .` + `which identikey`
  - [ ] Run CLI smoke tests: `identikey --help`, `identikey --version`

## Dev Notes

### Learnings from Previous Story

**From Story 1-3-testing-and-deployment (Status: done)**

**Implementation Patterns to Reuse:**

- **CI/CD Structure**: Use multi-job workflow pattern established in `.github/workflows/ci.yml` - add CLI tests as separate job after build
- **Test Organization**: Follow layered test structure (unit → integration → E2E) established in Epic 1
- **Documentation Pattern**: Mirror README structure for CLI (installation, quick start, API reference, examples)
- **Error Handling**: Follow clear error message pattern validated in corruption tests

**Files Created (available for reference):**

- `.github/workflows/ci.yml`: Complete CI pipeline with MinIO service, lint, test, build, integration jobs
- `tests/security/`: Security test patterns (correlation, tampering, corruption)
- `tests/benchmarks/`: Performance benchmark patterns
- `docs/deployment-guide.md`: Production deployment guide structure
- `examples/`: Example script patterns (basic-usage, key-management, multiple-recipients)

**Technical Constraints:**

- Test coverage threshold: 90% minimum (enforced in CI)
- TypeScript strict mode: `tsc --noEmit` must pass
- Bun runtime: Use `bun:test` for tests consistently
- Documentation: All internal links must be valid

**Review Findings (apply to this story):**

- Ensure coverage threshold enforced (AC9 gap in previous story)
- Validate all documentation links before completion
- Run performance benchmarks in CI (AC4/AC5 pattern)
- ESM imports only (no `require()`)

[Source: docs/stories/1-3-testing-and-deployment.md#Completion-Notes]

### Architecture Alignment

**Core Library Integration:**

- Use `generateKeyPair()` from `src/keypair.ts` for key generation
- Use `fingerprint()` from `src/header/fingerprint.ts` for fingerprinting
- Use `parseHeader()` from `src/header/parse.ts` for info command
- Use `EncryptedStorage.encrypt()` / `.decrypt()` from `src/api/encrypted-storage.ts`
- NOTE: CLI is pure consumer layer - no new crypto primitives

**ASCII Armor Specification:**

- Implement per `docs/architecture/ascii-armoring-spec.md`:
  - Public/Private Keys: Base58 with CRC24, no line wrapping
  - Messages: Base64 with 64-char line wrapping, CRC24 checksum
  - Headers: Version, KeyType, Fingerprint, Encrypted, Salt, Nonce
  - Delimiters: `----- BEGIN/END IDENTIKEY <TYPE> -----`
  - CRC24 polynomial: 0x864CFB (OpenPGP standard)
- Auto-detection: Check for `----- BEGIN IDENTIKEY` prefix

**Persona Config Structure:**

```json
{
  "activePersona": "default",
  "personas": {
    "default": {
      "name": "default",
      "keyPath": "~/.config/identikey/personas/default/id.json",
      "publicKeyPath": "~/.config/identikey/personas/default/id.json",
      "createdAt": "2025-10-31T10:00:00Z",
      "fingerprint": "abc123..."
    }
  }
}
```

**Encrypted Key File Format:**

```json
{
  "version": 1,
  "publicKey": "<base58_or_armored>",
  "privateKey": "<encrypted_with_passphrase>",
  "salt": "<base64_16_bytes>",
  "nonce": "<base64_24_bytes>",
  "fingerprint": "<sha256_hex>"
}
```

[Source: docs/tech-spec-epic-2.md#Data-Models]

### Project Structure Notes

**New CLI Module Structure:**

```
src/cli/
  index.ts               # CLI entry point, Commander.js setup
  commands/
    keygen.ts            # Keygen command
    encrypt.ts           # Encrypt command
    decrypt.ts           # Decrypt command
    fingerprint.ts       # Fingerprint command
    info.ts              # Info command
    persona.ts           # Persona command
  utils/
    persona-manager.ts   # Persona config management
    armor.ts             # ASCII armor/dearmor
    key-encryption.ts    # Passphrase-based key encryption
    file-io.ts           # Stdin/stdout helpers
    output-formatter.ts  # JSON/table formatting
    error-handler.ts     # Error message mapping

bin/
  identikey              # Shebang script (#!/usr/bin/env node)

tests/cli/
  commands/              # Unit tests for each command
  integration/           # Integration tests (piping, workflows)
```

**Package.json Updates:**

- Add `bin` field: `{ "identikey": "./dist/cli/index.js" }` (adjust for build output)
- Add CLI dependencies: commander, chalk, ora, cli-table3
- Add `test:cli` script
- Consider separate `@noble/hashes` for Argon2id KDF

### Cross-Platform Considerations

- **Shebang:** Use `#!/usr/bin/env node` (works on macOS/Linux, test on Windows WSL)
- **Stdin/stdout:** Use Buffer, not string, for binary data handling
- **File permissions:** Set privkey file to 0600 (owner-only read/write) on Unix systems
- **Config path:** `~/.config/identikey` on Unix, `%APPDATA%/identikey` on Windows (use `os.homedir()` + `.config`)

### Testing Strategy

**Unit Tests:**

- Mock file I/O (stdin/stdout/files) using test fixtures
- Mock PersonaManager config file access
- Validate argument parsing edge cases
- Test ASCII armor/dearmor roundtrips with various inputs
- Test CRC24 checksum validation
- Test passphrase encryption/decryption
- Target: >90% coverage for src/cli/

**Integration Tests:**

- Run against real file system (use temp directories)
- Test full piping workflows: `echo "test" | identikey encrypt | identikey decrypt`
- Test persona creation, switching, and usage
- Test ASCII armor end-to-end
- Test config file persistence
- Test progress indicators (large file encryption)

**Manual Tests (Cross-Platform):**

- Install globally: `bun install -g .`
- Verify command available: `which identikey`
- Test on macOS, Linux, Windows WSL
- Test large file encryption with progress bar
- Test error messages with real users (validate clarity)

### References

- **Tech Spec:** `docs/tech-spec-epic-2.md` (Epic 2 overview, detailed design, ACs, NFRs)
- **ASCII Armor Spec:** `docs/architecture/ascii-armoring-spec.md` (Complete armor format specification)
- **Epic Breakdown:** `docs/epics-cli-examples.md` (Story map, deliverables, risk mitigation)
- **Core Library API:**
  - `src/keypair.ts`: Key generation
  - `src/header/fingerprint.ts`: Fingerprint calculation
  - `src/header/parse.ts`: Header parsing for info command
  - `src/api/encrypted-storage.ts`: Encrypt/decrypt API
- **Previous Story:** `docs/stories/1-3-testing-and-deployment.md` (CI/CD patterns, test structure, learnings)
- **CI Pipeline:** `.github/workflows/ci.yml` (Multi-job workflow pattern to extend)

## Dev Agent Record

### Context Reference

- `docs/stories/2-1-cli-tool-foundation.context.xml` - Story context with documentation artifacts, code references, interfaces, constraints, dependencies, and test ideas

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes List

<!-- Will be populated during dev-story execution -->

### File List

<!-- Will be populated during dev-story execution -->

# Story: CLI Tool Foundation

Status: Draft

## Story

As a **developer using IdentiKey Tools**,
I want **a command-line interface built into the library**,
so that **I can quickly test encryption operations, generate keys, and inspect blobs without writing custom scripts**.

## Acceptance Criteria

1. **AC1:** CLI installable globally via `bun install -g identikey-tools`, accessible as `identikey` command
2. **AC2:** `identikey keygen` generates keypair, saves to disk, displays fingerprint and file paths
3. **AC3:** `identikey encrypt <input> -k <public-key>` encrypts file or stdin, outputs to file or stdout
4. **AC4:** `identikey decrypt <input> -k <private-key>` decrypts file or stdin, outputs plaintext to file or stdout
5. **AC5:** `identikey fingerprint <public-key>` displays SHA-256 fingerprint of public key
6. **AC6:** `identikey info <blob>` parses and displays blob metadata without decrypting (algorithm, timestamp, filename, checksum)
7. **AC7:** All commands support `--json` flag for machine-readable output
8. **AC8:** Stdin/stdout piping works: `cat file | identikey encrypt -k pub.key | identikey decrypt -k priv.key`
9. **AC9:** Progress indicators display for files > 10MB during encrypt/decrypt operations
10. **AC10:** Error messages are clear and actionable (e.g., "Public key not found: ./pub.key → Generate keys with: identikey keygen")
11. **AC11:** `--help` displays usage information for each command
12. **AC12:** Unit tests cover all commands with mocked file I/O

## Tasks / Subtasks

### Phase 1: CLI Framework Setup (AC: #1, #11)

- [ ] Install dependencies: `bun add commander chalk ora cli-table3` (AC: #1)
- [ ] Create `src/cli/index.ts` with Commander.js program setup (AC: #1)
- [ ] Create `bin/identikey` shebang script pointing to cli/index.ts (AC: #1)
- [ ] Update package.json with `"bin": { "identikey": "./dist/cli/index.js" }` (AC: #1)
- [ ] Register 5 commands with Commander (keygen, encrypt, decrypt, fingerprint, info) (AC: #11)
- [ ] Add global `--help` and per-command `--help` text (AC: #11)
- [ ] Test local installation: `bun install -g .` and verify `identikey --help` works (AC: #1)

### Phase 2: Keygen Command (AC: #2, #7, #10)

- [ ] Create `src/cli/commands/keygen.ts` (AC: #2)
- [ ] Implement keypair generation using library's `generateKeyPair()` (AC: #2)
- [ ] Compute and display fingerprint using `computeFingerprint()` (AC: #2)
- [ ] Accept `--output <dir>` option (default: ./keys) (AC: #2)
- [ ] Save public.key and private.key to output directory (AC: #2)
- [ ] Display success message with file paths and fingerprint (AC: #2)
- [ ] Implement `--json` output mode with structured data (AC: #7)
- [ ] Add error handling: output directory creation, permission errors (AC: #10)
- [ ] Write unit tests: `src/cli/commands/keygen.test.ts` (AC: #12)

### Phase 3: Encrypt Command (AC: #3, #7, #8, #9, #10)

- [ ] Create `src/cli/commands/encrypt.ts` (AC: #3)
- [ ] Implement file reading or stdin detection (input === '-') (AC: #3, #8)
- [ ] Load public key from file path (AC: #3)
- [ ] Call `encrypt()` from crypto module (AC: #3)
- [ ] Build header with `buildHeader()` using metadata (AC: #3)
- [ ] Concatenate header + ciphertext into blob (AC: #3)
- [ ] Write to output file or stdout based on `--output` option (AC: #3, #8)
- [ ] Accept `--metadata <json>` option for custom metadata (AC: #3)
- [ ] Add progress indicator with Ora for large files (> 10MB) (AC: #9)
- [ ] Implement error handling: key not found, invalid key format, read errors (AC: #10)
- [ ] Write unit tests: `src/cli/commands/encrypt.test.ts` (AC: #12)

### Phase 4: Decrypt Command (AC: #4, #7, #8, #9, #10)

- [ ] Create `src/cli/commands/decrypt.ts` (AC: #4)
- [ ] Implement file reading or stdin detection (AC: #4, #8)
- [ ] Load private key from file path (AC: #4)
- [ ] Parse header with `parseHeader()` (AC: #4)
- [ ] Extract ciphertext from blob (AC: #4)
- [ ] Call `decrypt()` with private key (AC: #4)
- [ ] Verify plaintext checksum if present in metadata (AC: #4)
- [ ] Write to output file or stdout based on `--output` option (AC: #4, #8)
- [ ] Add progress indicator for large blobs (AC: #9)
- [ ] Implement error handling: key not found, decryption failed, checksum mismatch (AC: #10)
- [ ] Write unit tests: `src/cli/commands/decrypt.test.ts` (AC: #12)

### Phase 5: Fingerprint & Info Commands (AC: #5, #6, #7, #10)

- [ ] Create `src/cli/commands/fingerprint.ts` (AC: #5)
- [ ] Load public key from file path (AC: #5)
- [ ] Compute and display fingerprint using `computeFingerprint()` (AC: #5)
- [ ] Implement `--json` output mode (AC: #7)
- [ ] Create `src/cli/commands/info.ts` (AC: #6)
- [ ] Load blob from file path (AC: #6)
- [ ] Parse header with `parseHeader()` to extract metadata (AC: #6)
- [ ] Display metadata in table format using CLI-Table3 (AC: #6)
- [ ] Implement `--json` output mode for metadata (AC: #7)
- [ ] Add error handling for both commands (AC: #10)
- [ ] Write unit tests: `fingerprint.test.ts` and `info.test.ts` (AC: #12)

### Phase 6: I/O Utilities & Error Handling (AC: #8, #10)

- [ ] Create `src/cli/utils/file-io.ts` (AC: #8)
- [ ] Implement `readInput(path)`: detects '-' for stdin, else reads file (AC: #8)
- [ ] Implement `writeOutput(data, path?)`: writes to file or stdout (AC: #8)
- [ ] Handle binary data correctly in stdin/stdout (AC: #8)
- [ ] Create `src/cli/utils/output-formatter.ts` (AC: #7)
- [ ] Implement JSON formatter for all commands (AC: #7)
- [ ] Implement table formatter for info command (AC: #6)
- [ ] Standardize error message format across commands (AC: #10)
- [ ] Add "Did you mean?" suggestions for common mistakes (AC: #10)

### Phase 7: Integration Testing (AC: #8, #12)

- [ ] Write `tests/cli/integration.test.ts` (AC: #12)
- [ ] Test full pipe: `encrypt | decrypt` returns original (AC: #8)
- [ ] Test keygen → encrypt → decrypt workflow (AC: #12)
- [ ] Test info command on generated blob (AC: #12)
- [ ] Test error scenarios: missing keys, corrupted blobs (AC: #12)
- [ ] Test JSON output mode for all commands (AC: #7, #12)
- [ ] Test progress indicators (mock large files) (AC: #9, #12)

## Dev Notes

### Technical Summary

Builds a production-ready CLI tool using Commander.js framework for command routing and argument parsing. Key design: Unix philosophy (stdin/stdout composability), clear error messages with actionable hints, progress feedback for long operations, and JSON output for scripting. All commands leverage the core encryption library with thin I/O wrappers.

**Command Architecture:**

```typescript
identikey
├── keygen    → generateKeyPair() + save to disk
├── encrypt   → read + encrypt() + buildHeader() + write
├── decrypt   → read + parseHeader() + decrypt() + write
├── fingerprint → computeFingerprint() + display
└── info      → parseHeader() + display metadata (no decrypt)
```

**I/O Strategy:**

- Detect stdin: `input === '-'` or `!process.stdin.isTTY`
- Write stdout: `process.stdout.write(buffer)`
- Binary data: use Buffer throughout, no string conversions
- Progress: only show if stderr is TTY (don't pollute pipes)

**Error Message Format:**

```
Error: Public key not found: ./pub.key
→ Generate keys with: identikey keygen
```

### Project Structure Notes

- **Files to create:**

  - `src/cli/index.ts`
  - `src/cli/commands/keygen.ts`
  - `src/cli/commands/encrypt.ts`
  - `src/cli/commands/decrypt.ts`
  - `src/cli/commands/fingerprint.ts`
  - `src/cli/commands/info.ts`
  - `src/cli/utils/file-io.ts`
  - `src/cli/utils/output-formatter.ts`
  - `bin/identikey`

- **Files to modify:**

  - `package.json` (add bin field, CLI scripts)
  - `tsconfig.json` (if needed for CLI module resolution)

- **Expected test locations:**

  - `tests/cli/commands/keygen.test.ts`
  - `tests/cli/commands/encrypt.test.ts`
  - `tests/cli/commands/decrypt.test.ts`
  - `tests/cli/commands/fingerprint.test.ts`
  - `tests/cli/commands/info.test.ts`
  - `tests/cli/integration.test.ts`

- **Estimated effort:** 3 story points (3-4 days)

### References

- **Tech Spec:** See `docs/tech-spec-cli-examples.md` - CLI Implementation section
- **Architecture:** Commander.js docs, Unix CLI best practices

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Will be populated during dev-story execution -->

### Debug Log References

<!-- Will be populated during dev-story execution -->

### Completion Notes List

<!-- Will be populated during dev-story execution -->

### File List

<!-- Will be populated during dev-story execution -->

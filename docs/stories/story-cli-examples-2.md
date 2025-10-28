# Story: Basic Example App

Status: Draft

## Story

As a **new developer learning IdentiKey Tools**,
I want **a simple, runnable example with zero configuration**,
so that **I can see how to import and use the library in under 1 minute**.

## Acceptance Criteria

1. **AC1:** `examples/basic/` directory exists with standalone package.json depending only on identikey-tools
2. **AC2:** `examples/basic/01-keygen.ts` generates keypair, displays fingerprint and key lengths
3. **AC3:** `examples/basic/02-inspect.ts` loads keypair from disk, displays fingerprint and key info
4. **AC4:** `examples/basic/README.md` provides "Get started in 30 seconds" quick start guide
5. **AC5:** Both example scripts run successfully with `bun run <script>`
6. **AC6:** Total execution time for both examples < 1 second
7. **AC7:** Examples use only public API (no internal imports)
8. **AC8:** Examples include inline comments explaining each step
9. **AC9:** No external dependencies required (no MinIO, no storage backend)
10. **AC10:** Smoke tests validate examples run and exit with code 0

## Tasks / Subtasks

### Phase 1: Directory Structure & Package Setup (AC: #1)

- [ ] Create `examples/basic/` directory (AC: #1)
- [ ] Create `examples/basic/package.json` (AC: #1)
- [ ] Set type: "module" for ES module support (AC: #1)
- [ ] Add dependency: `"identikey-tools": "workspace:*"` (AC: #1)
- [ ] Add scripts: `"keygen": "bun run 01-keygen.ts"`, `"inspect": "bun run 02-inspect.ts"` (AC: #1)
- [ ] Create `.gitignore` to exclude generated keys (AC: #1)

### Phase 2: Keygen Example Script (AC: #2, #7, #8)

- [ ] Create `examples/basic/01-keygen.ts` (AC: #2)
- [ ] Import `generateKeyPair` from 'identikey-tools' (AC: #7)
- [ ] Import `computeFingerprint` from 'identikey-tools/header' (AC: #7)
- [ ] Generate keypair with inline comment explaining Curve25519 (AC: #8)
- [ ] Compute and display fingerprint (AC: #2)
- [ ] Display public key length (32 bytes) (AC: #2)
- [ ] Display private key length (32 bytes) (AC: #2)
- [ ] Add comment about saving keys securely (production pattern) (AC: #8)
- [ ] Verify script runs in < 500ms (AC: #6)

### Phase 3: Inspect Example Script (AC: #3, #7, #8)

- [ ] Create `examples/basic/02-inspect.ts` (AC: #3)
- [ ] Import necessary functions from 'identikey-tools' (AC: #7)
- [ ] Load keypair from disk (public.key and private.key) (AC: #3)
- [ ] Handle file not found error gracefully with helpful message (AC: #3)
- [ ] Compute fingerprint from loaded public key (AC: #3)
- [ ] Display key information: fingerprint, lengths, format (AC: #3)
- [ ] Add inline comments explaining key loading and fingerprint verification (AC: #8)
- [ ] Verify script runs in < 500ms (AC: #6)

### Phase 4: README Documentation (AC: #4)

- [ ] Create `examples/basic/README.md` (AC: #4)
- [ ] Add title: "Basic Example - Keypair Generation" (AC: #4)
- [ ] Add "Get started in 30 seconds" section (AC: #4)
- [ ] Document install step: `cd examples/basic && bun install` (AC: #4)
- [ ] Document run step: `bun run keygen` (AC: #4)
- [ ] Add "What's Happening?" section explaining the code (AC: #4)
- [ ] Add "Next Steps" section linking to complex example (AC: #4)
- [ ] Include code snippets showing key functions (AC: #4)

### Phase 5: Testing (AC: #5, #6, #10)

- [ ] Create `tests/examples/basic.test.ts` (AC: #10)
- [ ] Write smoke test: run 01-keygen.ts, verify exit code 0 (AC: #10)
- [ ] Write smoke test: run 02-inspect.ts, verify exit code 0 or file-not-found message (AC: #10)
- [ ] Validate output contains expected strings: "fingerprint", "generated" (AC: #10)
- [ ] Measure execution time, assert < 1 second total (AC: #6)
- [ ] Test examples use only public API (grep for internal imports) (AC: #7)

### Phase 6: Polish & Validation (AC: #5, #8, #9)

- [ ] Verify no external dependencies beyond identikey-tools (AC: #9)
- [ ] Check all inline comments are clear and educational (AC: #8)
- [ ] Run examples manually to validate UX (AC: #5)
- [ ] Ensure error messages are beginner-friendly (AC: #8)
- [ ] Validate README copy-paste works end-to-end (AC: #4)

## Dev Notes

### Technical Summary

Creates minimal "Hello World" style examples for new users. Focus: zero friction, maximum clarity. Examples demonstrate only keypair generation and inspection - no storage, no MinIO, no complex workflows. All code is heavily commented to serve as inline documentation. Fast execution (< 1 second) reinforces simplicity.

**Example Structure:**

```
examples/basic/
├── README.md           # "30 seconds to success"
├── package.json        # Just identikey-tools
├── 01-keygen.ts        # Generate → display fingerprint
└── 02-inspect.ts       # Load → verify fingerprint
```

**01-keygen.ts Pattern:**

```typescript
import { generateKeyPair } from "identikey-tools";
import { computeFingerprint } from "identikey-tools/header";

// Generate Curve25519 keypair for public-key encryption
const keypair = generateKeyPair();

// Compute SHA-256 fingerprint for key identification
const fingerprint = computeFingerprint(keypair.publicKey);

console.log(`✓ Keypair generated!`);
console.log(`  Fingerprint: ${fingerprint}`);
```

**02-inspect.ts Pattern:**

```typescript
import { readFileSync } from "fs";
import { computeFingerprint } from "identikey-tools/header";

// Load previously saved public key
const publicKey = new Uint8Array(readFileSync("./public.key"));

// Verify fingerprint matches
const fingerprint = computeFingerprint(publicKey);

console.log(`Key loaded: ${fingerprint}`);
```

### Project Structure Notes

- **Files to create:**

  - `examples/basic/package.json`
  - `examples/basic/README.md`
  - `examples/basic/01-keygen.ts`
  - `examples/basic/02-inspect.ts`
  - `examples/basic/.gitignore`

- **Files to modify:**

  - None (standalone example)

- **Expected test locations:**

  - `tests/examples/basic.test.ts`

- **Estimated effort:** 2 story points (1 day)

### References

- **Tech Spec:** See `docs/tech-spec-cli-examples.md` - Basic Example Implementation section
- **Pattern:** Similar to TweetNaCl examples, OpenSSL quick starts

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

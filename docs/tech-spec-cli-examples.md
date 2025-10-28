# IdentiKey Tools - Technical Specification: CLI & Developer Examples

**Author:** Master d0rje
**Date:** 2025-10-28
**Project Level:** 1
**Project Type:** product
**Development Context:** greenfield

---

## Source Tree Structure

```
src/
  cli/
    index.ts               # CLI entry point, command router
    commands/
      keygen.ts            # Generate and save keypair
      encrypt.ts           # Encrypt file/stdin to stdout
      decrypt.ts           # Decrypt file/stdin to stdout
      fingerprint.ts       # Show public key fingerprint
      info.ts              # Show blob metadata without decrypting
    utils/
      args-parser.ts       # CLI argument parsing
      file-io.ts           # File read/write helpers
      output-formatter.ts  # JSON/text output formatting

examples/
  basic/
    package.json           # Minimal dependencies (just identikey-tools)
    README.md              # Quick start guide
    01-keygen.ts           # Generate keypair, show fingerprint
    02-inspect.ts          # Load keypair, display info
  complex/
    package.json           # Full dependencies (identikey-tools + minio)
    README.md              # Full workflow guide
    setup-minio.ts         # MinIO connection test
    full-workflow.ts       # End-to-end: keygen → encrypt → store → retrieve → decrypt
    batch-encrypt.ts       # Encrypt multiple files
    key-rotation.ts        # Demonstrate key rotation pattern

bin/
  identikey               # Shebang script pointing to cli/index.ts

tests/
  cli/
    keygen.test.ts         # CLI keygen tests
    encrypt.test.ts        # CLI encrypt tests
    decrypt.test.ts        # CLI decrypt tests
  examples/
    basic.test.ts          # Validate basic examples run
    complex.test.ts        # Validate complex examples run
```

---

## Technical Approach

### Core Design Pattern: Developer-Friendly Tooling

Build a comprehensive developer experience around the identikey-tools library with three tiers:

1. **Built-in CLI** - Ships with the package, provides immediate utility
2. **Basic Example** - "Hello World" for new users (keypair generation only)
3. **Complex Example** - Real-world usage patterns (full encryption workflow)

**Key Philosophy:** Show, don't tell. Developers learn by running code, not reading docs.

### CLI Architecture

**Command Structure:**

```bash
identikey keygen [--output ./keys]
identikey encrypt <input> --key <public-key> [--output <file>]
identikey decrypt <input> --key <private-key> [--output <file>]
identikey fingerprint <public-key>
identikey info <encrypted-blob>
```

**Design Decisions:**

1. **Stdin/Stdout Support** - Unix philosophy (pipe-friendly)

   ```bash
   cat secret.txt | identikey encrypt --key pub.key | identikey decrypt --key priv.key
   ```

2. **JSON Output Option** - Machine-readable for scripting

   ```bash
   identikey info blob.enc --json
   ```

3. **Progress Indicators** - User feedback for large files

   ```bash
   identikey encrypt largefile.zip --key pub.key
   [████████████████░░░░] 80% (800MB/1GB)
   ```

4. **Error Handling** - Clear, actionable messages
   ```bash
   Error: Public key not found: ./pub.key
   → Generate keys with: identikey keygen
   ```

### Example Apps Strategy

**Basic Example (examples/basic/):**

- Single file: `01-keygen.ts`
- Zero external deps (just identikey-tools)
- Runs in < 1 second
- Shows: import lib → generate keypair → display fingerprint → save to disk

**Complex Example (examples/complex/):**

- Multiple files showing progression
- Full dependencies (MinIO client)
- Shows: MinIO setup → full encrypt/store/retrieve/decrypt → batch operations → key rotation
- Includes timing/performance output

**Why Two Examples?**

- Basic: Onboarding (copy-paste into your project)
- Complex: Production patterns (how to actually use it)

---

## Implementation Stack

### Core Dependencies (Already in Project)

| Library        | Version | Purpose                                          |
| -------------- | ------- | ------------------------------------------------ |
| **commander**  | ^11.1.0 | CLI framework (command parsing, help generation) |
| **chalk**      | ^5.3.0  | Terminal colors for better UX                    |
| **ora**        | ^8.0.1  | Spinners/progress indicators                     |
| **cli-table3** | ^0.6.3  | Pretty table output for info command             |

### Development Dependencies

| Tool            | Version | Purpose                  |
| --------------- | ------- | ------------------------ |
| **@types/node** | ^20.0.0 | Node.js type definitions |

### Runtime Environment

- **Node.js**: >= 18.0.0 (same as main library)
- **Bun**: ^1.0.0 (preferred runtime)
- **MinIO**: For complex example only (user's infra)

---

## Technical Details

### CLI Implementation

**Entry Point (bin/identikey):**

```typescript
#!/usr/bin/env node
import { program } from "commander";
import { keygenCommand } from "./commands/keygen.js";
import { encryptCommand } from "./commands/encrypt.js";
import { decryptCommand } from "./commands/decrypt.js";
import { fingerprintCommand } from "./commands/fingerprint.js";
import { infoCommand } from "./commands/info.js";

program
  .name("identikey")
  .description("IdentiKey Tools CLI - Encryption and key management")
  .version("1.0.0");

program
  .command("keygen")
  .description("Generate a new keypair")
  .option("-o, --output <dir>", "Output directory", "./keys")
  .option("--json", "Output as JSON")
  .action(keygenCommand);

program
  .command("encrypt <input>")
  .description("Encrypt a file or stdin")
  .requiredOption("-k, --key <file>", "Public key file")
  .option("-o, --output <file>", "Output file (default: stdout)")
  .option("--metadata <json>", "Additional metadata (JSON string)")
  .action(encryptCommand);

program
  .command("decrypt <input>")
  .description("Decrypt a file or stdin")
  .requiredOption("-k, --key <file>", "Private key file")
  .option("-o, --output <file>", "Output file (default: stdout)")
  .action(decryptCommand);

program
  .command("fingerprint <key>")
  .description("Show public key fingerprint")
  .action(fingerprintCommand);

program
  .command("info <blob>")
  .description("Show encrypted blob metadata")
  .option("--json", "Output as JSON")
  .action(infoCommand);

program.parse();
```

**Keygen Command Logic:**

```typescript
// src/cli/commands/keygen.ts
import { generateKeyPair } from "../../keypair.js";
import { computeFingerprint } from "../../header/fingerprint.js";
import { writeFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import chalk from "chalk";

export async function keygenCommand(options: {
  output: string;
  json: boolean;
}) {
  const spinner = ora("Generating keypair...").start();

  const keypair = generateKeyPair();
  const fingerprint = computeFingerprint(keypair.publicKey);

  const outputDir = options.output;
  const pubPath = join(outputDir, "public.key");
  const privPath = join(outputDir, "private.key");

  // Save keys (consider encrypting private key in production)
  writeFileSync(pubPath, Buffer.from(keypair.publicKey));
  writeFileSync(privPath, Buffer.from(keypair.secretKey));

  spinner.succeed("Keypair generated!");

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          publicKey: pubPath,
          privateKey: privPath,
          fingerprint,
        },
        null,
        2
      )
    );
  } else {
    console.log(chalk.green("✓ Keypair generated successfully"));
    console.log(`  Public key:  ${chalk.cyan(pubPath)}`);
    console.log(`  Private key: ${chalk.yellow(privPath)}`);
    console.log(`  Fingerprint: ${chalk.gray(fingerprint)}`);
    console.log(chalk.dim("\n  Keep your private key secure!"));
  }
}
```

**Encrypt Command Logic:**

```typescript
// src/cli/commands/encrypt.ts
import { readFileSync, writeFileSync } from "fs";
import { encrypt } from "../../crypto/encryptor.js";
import { buildHeader } from "../../header/serialize.js";
import { computeFingerprint } from "../../header/fingerprint.js";
import { createHash } from "crypto";
import ora from "ora";

export async function encryptCommand(
  input: string,
  options: { key: string; output?: string; metadata?: string }
) {
  const spinner = ora("Reading input...").start();

  // Read plaintext
  const plaintext = input === "-" ? readStdin() : readFileSync(input);

  // Read public key
  const publicKey = new Uint8Array(readFileSync(options.key));
  const fingerprint = computeFingerprint(publicKey);

  spinner.text = "Encrypting...";

  // Encrypt
  const ciphertext = await encrypt(plaintext, publicKey);

  // Build header
  const metadata = options.metadata ? JSON.parse(options.metadata) : {};
  const fullMetadata = {
    algorithm: "TweetNaCl-Box",
    timestamp: Date.now(),
    plaintextChecksum: createHash("sha256").update(plaintext).digest("hex"),
    ...metadata,
  };

  const header = buildHeader(fullMetadata, fingerprint);
  const blob = Buffer.concat([header, ciphertext]);

  spinner.succeed("Encryption complete!");

  // Output
  if (options.output) {
    writeFileSync(options.output, blob);
    console.log(`Encrypted to: ${options.output}`);
  } else {
    process.stdout.write(blob);
  }
}
```

### Basic Example Implementation

**examples/basic/01-keygen.ts:**

```typescript
// Simple keypair generation example
import { generateKeyPair } from "identikey-tools";
import { computeFingerprint } from "identikey-tools/header";

console.log("🔑 Generating keypair...\n");

const keypair = generateKeyPair();
const fingerprint = computeFingerprint(keypair.publicKey);

console.log("✓ Keypair generated!");
console.log(`  Fingerprint: ${fingerprint}`);
console.log(`  Public key length: ${keypair.publicKey.length} bytes`);
console.log(`  Private key length: ${keypair.secretKey.length} bytes`);

// In production, save these securely:
// import { writeFileSync } from 'fs';
// writeFileSync('./public.key', Buffer.from(keypair.publicKey));
// writeFileSync('./private.key', Buffer.from(keypair.secretKey));
```

**examples/basic/package.json:**

```json
{
  "name": "identikey-basic-example",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "keygen": "bun run 01-keygen.ts",
    "inspect": "bun run 02-inspect.ts"
  },
  "dependencies": {
    "identikey-tools": "workspace:*"
  }
}
```

### Complex Example Implementation

**examples/complex/full-workflow.ts:**

```typescript
// Full encryption workflow demonstration
import { generateKeyPair, KeyManager } from "identikey-tools";
import { EncryptedStorage } from "identikey-tools/api";
import { MinioAdapter } from "identikey-tools/storage";
import { readFileSync } from "fs";

console.log("🚀 IdentiKey Full Workflow Demo\n");

// Step 1: Generate keypair
console.log("[1/5] Generating keypair...");
const keypair = generateKeyPair();
const keyManager = new KeyManager();
keyManager.addKey(keypair.publicKey, keypair.secretKey);
console.log("✓ Keypair ready\n");

// Step 2: Setup storage
console.log("[2/5] Connecting to MinIO...");
const storage = new MinioAdapter({
  endpoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  bucket: "identikey-demo",
});
console.log("✓ Storage connected\n");

// Step 3: Create encrypted storage instance
const encryptedStorage = new EncryptedStorage(storage, keyManager);

// Step 4: Encrypt and store
console.log("[3/5] Encrypting and storing data...");
const plaintext = Buffer.from("Super secret message! 🔐");
const contentHash = await encryptedStorage.put(plaintext, keypair.publicKey, {
  originalFilename: "secret.txt",
  contentType: "text/plain",
});
console.log(`✓ Stored with hash: ${contentHash}\n`);

// Step 5: Retrieve and decrypt
console.log("[4/5] Retrieving and decrypting...");
const decrypted = await encryptedStorage.get(contentHash);
console.log(`✓ Decrypted: "${decrypted.toString()}"\n`);

// Step 6: Verify
console.log("[5/5] Verifying integrity...");
const matches = plaintext.equals(decrypted);
console.log(matches ? "✓ Integrity verified!\n" : "✗ Mismatch!\n");

// Metadata inspection
console.log("📋 Blob Metadata:");
const metadata = await encryptedStorage.getMetadata(contentHash);
console.table(metadata);

console.log("\n✨ Workflow complete!");
```

---

## Development Setup

### Prerequisites

Already installed:

- Bun v1.x
- TypeScript
- identikey-tools library (from Story 1-2)

### Install CLI Dependencies

```bash
bun add commander chalk ora cli-table3
bun add -d @types/node
```

### Package.json Updates

```json
{
  "name": "identikey-tools",
  "version": "1.0.0",
  "bin": {
    "identikey": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsdown",
    "build:cli": "tsdown src/cli/index.ts --out dist/cli",
    "cli": "bun run src/cli/index.ts",
    "example:basic": "cd examples/basic && bun run keygen",
    "example:complex": "cd examples/complex && bun run full-workflow.ts"
  },
  "exports": {
    ".": "./dist/index.js",
    "./crypto": "./dist/crypto/index.js",
    "./header": "./dist/header/index.js",
    "./storage": "./dist/storage/index.js",
    "./api": "./dist/api/index.js"
  }
}
```

---

## Implementation Guide

### Phase 1: CLI Foundation (Story 1, Week 1)

**Files to create:**

1. `src/cli/index.ts` - Entry point with commander setup
2. `src/cli/commands/keygen.ts` - Keygen command
3. `src/cli/commands/encrypt.ts` - Encrypt command
4. `src/cli/commands/decrypt.ts` - Decrypt command
5. `src/cli/commands/fingerprint.ts` - Fingerprint command
6. `src/cli/commands/info.ts` - Info command
7. `src/cli/utils/args-parser.ts` - Argument validation helpers
8. `src/cli/utils/file-io.ts` - File I/O helpers (stdin/stdout)
9. `src/cli/utils/output-formatter.ts` - JSON/table formatting
10. `bin/identikey` - Shebang wrapper script

**Key functions:**

- Command router with commander.js
- File/stdin handling with graceful errors
- Progress indicators for large files
- JSON output mode for scripting

**Tests:**

- Unit tests: Each command with mocked I/O
- Integration tests: Full CLI workflows
- Error handling: Invalid keys, missing files, corrupted data

**Deliverable:** Working CLI tool, installable via `bun install -g`

---

### Phase 2: Basic Example (Story 2, Day 1-2)

**Files to create:**

1. `examples/basic/package.json` - Minimal dependencies
2. `examples/basic/README.md` - Quick start guide
3. `examples/basic/01-keygen.ts` - Generate and display keypair
4. `examples/basic/02-inspect.ts` - Load and inspect keypair

**Example Structure:**

```
examples/basic/
├── README.md           # "Get started in 30 seconds"
├── package.json        # Just identikey-tools dependency
├── 01-keygen.ts        # Generate keypair
└── 02-inspect.ts       # Load keypair, show fingerprint
```

**README.md Format:**

```markdown
# Basic Example - Keypair Generation

Get started with IdentiKey Tools in 30 seconds.

## Install

\`\`\`bash
cd examples/basic
bun install
\`\`\`

## Run

\`\`\`bash
bun run keygen
\`\`\`

## What's Happening?

1. Generates Curve25519 keypair
2. Computes SHA-256 fingerprint
3. Shows key lengths and fingerprint

## Next Steps

Check out `examples/complex/` for full encryption workflows.
```

**Tests:**

- Smoke test: Run each example, verify exit code 0
- Output validation: Check for expected strings

**Deliverable:** Copy-paste ready examples for new users

---

### Phase 3: Complex Example (Story 3, Day 3-5)

**Files to create:**

1. `examples/complex/package.json` - Full dependencies
2. `examples/complex/README.md` - Complete workflow guide
3. `examples/complex/.env.example` - MinIO config template
4. `examples/complex/setup-minio.ts` - Connection test
5. `examples/complex/full-workflow.ts` - End-to-end demo
6. `examples/complex/batch-encrypt.ts` - Multiple files
7. `examples/complex/key-rotation.ts` - Key rotation pattern

**Full Workflow Script (full-workflow.ts):**

```typescript
// 1. Generate keypair
// 2. Connect to MinIO
// 3. Encrypt plaintext
// 4. Store encrypted blob
// 5. Retrieve by content hash
// 6. Decrypt and verify
// 7. Show metadata
// 8. Performance metrics
```

**Batch Encrypt Script (batch-encrypt.ts):**

```typescript
// Demonstrates encrypting multiple files efficiently
// Shows progress bar for long operations
// Stores all blobs, returns array of content hashes
```

**Key Rotation Script (key-rotation.ts):**

```typescript
// Pattern: Old key → decrypt → new key → encrypt
// Shows how to migrate encrypted data to new keypair
```

**README.md Format:**

```markdown
# Complex Example - Full Encryption Workflow

Production-ready patterns for IdentiKey Tools.

## Prerequisites

- MinIO running (see main README for Docker setup)
- Environment variables configured (copy .env.example to .env)

## Examples

### Full Workflow

\`\`\`bash
bun run full-workflow.ts
\`\`\`

Demonstrates: keygen → encrypt → store → retrieve → decrypt

### Batch Operations

\`\`\`bash
bun run batch-encrypt.ts ./files/\*.txt
\`\`\`

Encrypts multiple files, shows progress.

### Key Rotation

\`\`\`bash
bun run key-rotation.ts <old-key> <new-key>
\`\`\`

Migrates encrypted data to new keypair.
```

**Tests:**

- Integration tests: Full workflow against test MinIO
- Performance tests: Measure throughput
- Error handling: Network failures, key mismatches

**Deliverable:** Real-world usage patterns developers can adapt

---

## Testing Approach

### Unit Tests (CLI Commands)

```bash
bun test src/cli/commands/*.test.ts
```

**Test files:**

- `src/cli/commands/keygen.test.ts` - Keygen output validation
- `src/cli/commands/encrypt.test.ts` - Encryption with mocked storage
- `src/cli/commands/decrypt.test.ts` - Decryption with valid/invalid keys
- `src/cli/commands/fingerprint.test.ts` - Fingerprint computation
- `src/cli/commands/info.test.ts` - Metadata extraction

**Key test cases:**

1. Valid inputs produce expected outputs
2. Invalid keys rejected with clear errors
3. Stdin/stdout piping works correctly
4. JSON output mode validates
5. Progress indicators don't break output

### Integration Tests (Examples)

```bash
bun test tests/examples/*.test.ts
```

**Test files:**

- `tests/examples/basic.test.ts` - Run basic examples, check exit codes
- `tests/examples/complex.test.ts` - Full workflow integration test

**Key scenarios:**

1. Basic example runs without errors
2. Complex example completes full cycle
3. Batch encrypt handles multiple files
4. Key rotation migrates data correctly

### Manual Testing Checklist

- [ ] Install CLI globally: `bun install -g`
- [ ] Run `identikey keygen` → keys generated
- [ ] Run `identikey encrypt test.txt -k pub.key -o test.enc` → encrypted
- [ ] Run `identikey decrypt test.enc -k priv.key` → decrypted to stdout
- [ ] Run `identikey info test.enc` → metadata displayed
- [ ] Run basic example → completes successfully
- [ ] Run complex example (MinIO running) → full workflow works
- [ ] Pipe test: `echo "secret" | identikey encrypt -k pub.key | identikey decrypt -k priv.key` → "secret"

---

## Deployment Strategy

### CLI Distribution

**NPM Package:**

```json
{
  "bin": {
    "identikey": "./dist/cli/index.js"
  }
}
```

**Installation:**

```bash
# From npm
npm install -g identikey-tools

# From source
bun install -g .

# Verify
identikey --version
```

### Example Distribution

**GitHub Repository Structure:**

```
identikey-tools/
├── src/              # Library source
├── examples/
│   ├── basic/        # Copy-paste examples
│   └── complex/      # Production patterns
├── docs/             # Documentation
└── README.md         # Links to examples
```

**Documentation:**

- Main README links to examples/
- Each example has standalone README
- Quick start guide: "5 minutes to encryption"

### Versioning

- CLI version matches library version
- Examples pinned to specific library version
- Breaking changes in CLI = major version bump

---

## Performance Considerations

### CLI Performance Targets

| Operation       | Target  | Notes                            |
| --------------- | ------- | -------------------------------- |
| Keygen          | < 100ms | Curve25519 key generation        |
| Encrypt 1MB     | < 200ms | Includes header building         |
| Decrypt 1MB     | < 150ms | Includes header parsing          |
| Info (metadata) | < 50ms  | Parse header only, no decryption |

### Example Performance

**Basic Example:**

- Total runtime: < 1 second
- Zero network calls
- Minimal memory (< 10MB)

**Complex Example:**

- Full workflow: < 5 seconds (local MinIO)
- Network overhead: ~100ms per storage op
- Memory: < 50MB for typical files

### Optimization Strategies

1. **Streaming for large files** - Don't buffer entire file in memory
2. **Lazy key loading** - Load private keys only when needed
3. **Parallel batch operations** - Encrypt multiple files concurrently
4. **Progress indicators** - Keep user engaged during long ops

---

## Risk Assessment

| Risk                    | Impact                  | Mitigation                                       |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| CLI UX confusion        | Medium - poor adoption  | User testing, clear error messages, help text    |
| Example outdated        | Low - docs mismatch     | Pin example versions to library, CI tests        |
| Stdin/stdout edge cases | Medium - pipe failures  | Comprehensive I/O tests, binary vs text handling |
| Cross-platform issues   | Medium - Windows compat | Test on Windows/Mac/Linux, shebang alternatives  |

---

## Open Questions for Implementation

1. **Private key encryption** - Should CLI encrypt private keys at rest?

   - **Recommendation:** Phase 2 feature, use passphrase protection

2. **Config file support** - Should CLI support ~/.identikeyrc config?

   - **Recommendation:** Nice-to-have, defer to post-MVP

3. **Shell completion** - Bash/Zsh autocomplete?

   - **Recommendation:** Post-MVP, use commander built-in support

4. **Windows support** - Test shebang alternatives?

   - **Recommendation:** Test in CI, provide .cmd wrapper if needed

5. **Example CI integration** - Run examples in CI pipeline?
   - **Recommendation:** Yes, catches regressions in API changes

---

**Document Status:** ✅ DEFINITIVE - Ready for Implementation
**Next Step:** Begin Story 1 (CLI Foundation)
**Estimated Timeline:** 1-1.5 weeks for all 3 stories

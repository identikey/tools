# IdentiKey Tools - Epic Breakdown: CLI & Developer Examples

## Epic Overview

**Epic:** Developer Tools & Examples

**Epic Slug:** cli-examples

**Goal:** Enable developers to quickly test, validate, and learn the IdentiKey Tools library through a built-in CLI tool and runnable example applications, accelerating adoption and reducing integration friction.

**Scope:**

- Build production-ready CLI tool shipped with the library (keygen, encrypt, decrypt, fingerprint, info commands)
- Create basic example app demonstrating keypair generation (zero storage deps)
- Create complex example app showing full encryption workflow (with MinIO integration)
- All examples are CLI-based (no web UI) for simplicity and maximum code visibility
- Focus on developer experience: clear errors, progress indicators, JSON output for scripting

**Success Criteria:**

- ✅ CLI tool installable globally via `bun install -g identikey-tools`
- ✅ All 5 CLI commands functional: keygen, encrypt, decrypt, fingerprint, info
- ✅ Stdin/stdout piping works: `cat file | identikey encrypt | identikey decrypt`
- ✅ Basic example runs in < 1 second with zero configuration
- ✅ Complex example demonstrates full encrypt→store→retrieve→decrypt cycle
- ✅ Error messages are clear and actionable (no stack traces for user errors)
- ✅ JSON output mode enables scripting: `identikey info blob.enc --json`
- ✅ Examples include READMEs with copy-paste quick starts
- ✅ All CLI commands + examples tested in CI

**Dependencies:**

- External: Commander.js, Chalk, Ora, CLI-Table3
- Internal: Core encryption library (Stories 1-2 from encrypted-storage epic)
- Infrastructure: MinIO (user's infra, already set up)

---

## Epic Details

### Story Map

```
Epic: Developer Tools & Examples
├── Story 1: CLI Tool Foundation (3 points) - Days 1-3 ✅
│   └── 6 commands + stdin/stdout + progress + JSON output + persona mgmt
├── Story 2: Dual-Key Persona Architecture (5 points) - Days 4-6
│   └── Ed25519 signing + Curve25519 encryption + persona identity + migration
├── Story 3: Basic Example App (2 points) - Day 7
│   └── Simple keypair generation demo
└── Story 4: Complex Example App (3 points) - Days 8-9
    └── Full workflow: encrypt → store → retrieve → decrypt
```

**Total Story Points:** 13 points
**Estimated Timeline:** 1.5-2 weeks

### Story Summaries

#### Story 1: CLI Tool Foundation

**Points:** 3 | **Status:** Done | **File:** `2-1-cli-tool-foundation.md`

Build the built-in CLI tool that ships with identikey-tools package. Implements 6 commands (keygen, encrypt, decrypt, fingerprint, info, persona) with Unix-friendly stdin/stdout support, progress indicators, and JSON output mode for scripting.

**Key Deliverables:**

- ✅ Commander.js-based CLI with 6 commands
- ✅ Stdin/stdout piping support
- ✅ Progress indicators for large files
- ✅ JSON output mode (`--json` flag)
- ✅ Clear error messages with actionable hints
- ✅ Persona management with passphrase encryption
- ✅ ASCII armoring support
- ✅ Unit tests for each command

**Current State:**

- Uses Curve25519 encryption keys
- Signing capability deferred to Story 2

---

#### Story 2: Dual-Key Persona Architecture

**Points:** 5 | **Status:** Planned | **File:** `2-2-dual-key-persona-architecture.md`

Implement dual-key persona architecture where each persona has separate Ed25519 signing keys (for persona identity) and Curve25519 encryption keys (for encryption operations). This enables persona publishing, identity verification, and proper cryptographic separation of concerns.

**Key Deliverables:**

- Ed25519 signing keypair generation
- Curve25519 encryption keypair generation (already implemented)
- Dual-key encrypted file format (v2)
- Update keygen to generate both key types
- Update all commands to use appropriate key type
- Implement `sign` and `verify` commands
- Persona manifest format specification
- Migration strategy from v1 (single-key) to v2 (dual-key)
- Update all tests for dual-key format
- Backward compatibility handling

**Architecture Reference:**

- See `docs/architecture/dual-key-persona-architecture.md`

**Dependencies:**

- Story 1 (CLI Tool Foundation) must be complete

**Breaking Changes:**

- Key file format changes from v1 to v2
- Users must regenerate keys
- Clear migration documentation required

---

#### Story 3: Basic Example App

**Points:** 2 | **Status:** Draft | **File:** `2-3-basic-example-app.md`

Create minimal example demonstrating keypair generation with zero external dependencies. Runs in < 1 second, shows developers how to import and use the library for basic operations.

**Key Deliverables:**

- `examples/basic/` directory with standalone package.json
- 2 example scripts: keygen + inspect
- Quick start README
- Smoke tests validating examples run

---

#### Story 4: Complex Example App

**Points:** 3 | **Status:** Draft | **File:** `2-4-complex-example-app.md`

Create comprehensive example demonstrating production patterns: full encryption workflow, batch operations, and key rotation. Includes MinIO integration, performance metrics, and detailed README.

**Key Deliverables:**

- `examples/complex/` directory with full dependencies
- 4 example scripts: full-workflow, batch-encrypt, key-rotation, setup-minio
- Production-ready patterns README
- Integration tests against MinIO

---

### Implementation Sequence

**Days 1-3: Story 1 (CLI Tool Foundation)**

- Day 1: Commander setup + keygen/fingerprint commands
- Day 2: Encrypt/decrypt commands with stdin/stdout
- Day 3: Info command, progress indicators, error handling, tests

**Dependencies:** Core library (Stories 1-2 of encrypted-storage epic)

---

**Day 4: Story 2 (Basic Example)**

- Morning: Create examples/basic/ structure + keygen example
- Afternoon: Inspect example + README + tests

**Dependencies:** CLI tool (Story 1) for reference patterns

---

**Days 5-6: Story 3 (Complex Example)**

- Day 5: Full workflow + batch encrypt scripts
- Day 6: Key rotation + MinIO setup + comprehensive README + tests

**Dependencies:** Core library + storage adapter (Story 2 of encrypted-storage epic)

---

### Risk Mitigation

| Risk                        | Story Impact | Mitigation Plan                                              |
| --------------------------- | ------------ | ------------------------------------------------------------ |
| Stdin/stdout edge cases     | Story 1      | Test binary data, large files, broken pipes early            |
| Cross-platform CLI issues   | Story 1      | Test shebang on Windows/Mac/Linux, provide .cmd wrapper      |
| Example API mismatch        | Stories 2-3  | Pin example deps to specific library version, CI validation  |
| MinIO connectivity          | Story 3      | Validate user's infra before implementation, include setup   |
| UX confusion                | Story 1      | User test CLI commands, iterate on error messages            |
| Commander.js learning curve | Story 1      | Prototype early, reference existing CLI tools (aws, openssl) |

---

### Definition of Done (Epic-Level)

- [ ] All 3 stories completed and merged
- [ ] Tech spec implementation 100% complete
- [ ] All acceptance criteria met across stories
- [ ] CLI installable globally via `bun install -g`
- [ ] All 5 CLI commands functional with tests
- [ ] Basic example runs successfully with zero config
- [ ] Complex example completes full workflow
- [ ] All examples have standalone READMEs
- [ ] CI pipeline runs CLI tests + example smoke tests
- [ ] Error messages tested and user-friendly
- [ ] Documentation complete (main README links to examples)
- [ ] Code reviewed and approved
- [ ] No critical or high-priority bugs

---

**Next Action:** Begin Story 1 - Build CLI tool foundation with Commander.js

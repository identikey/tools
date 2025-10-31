import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import nacl from "tweetnacl";
import { EncryptedStorage } from "../../src/api/encrypted-storage.js";
import { KeyManager } from "../../src/keypair.js";
import { MemoryAdapter } from "../../src/storage/memory-adapter.js";

/**
 * Performance Benchmark: Encryption + Storage
 *
 * Measures end-to-end latency for encrypt + store workflow.
 * Uses in-memory storage (no network dependency).
 * Target: 1MB file encrypt + store < 500ms
 *
 * Acceptance Criteria: AC4
 */
describe("Benchmark: Encryption Performance", () => {
  let storage: EncryptedStorage;
  let keyManager: KeyManager;
  let kp: nacl.BoxKeyPair;
  let adapter: MemoryAdapter;

  beforeAll(async () => {
    // Setup in-memory adapter (no network, fast)
    adapter = new MemoryAdapter();
    keyManager = new KeyManager();
    storage = new EncryptedStorage(adapter, keyManager);

    // Generate keypair for tests
    kp = nacl.box.keyPair();
    keyManager.addKey(kp.publicKey, kp.secretKey);
  });

  afterAll(() => {
    // Cleanup in-memory storage
    adapter.clear();
  });

  it("1MB encrypt + store completes in < 500ms", async () => {
    // Generate 1MB plaintext
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB
    for (let i = 0; i < plaintext.length; i++) {
      plaintext[i] = i % 256;
    }

    // Measure encrypt + upload latency
    const startTime = performance.now();
    const contentHash = await storage.put(plaintext, kp.publicKey, {
      originalFilename: "benchmark-1mb.bin",
      contentType: "application/octet-stream",
    });
    const endTime = performance.now();

    const latency = endTime - startTime;

    console.log(`  ✓ 1MB encrypt+store: ${latency.toFixed(2)}ms`);

    // Verify blob was stored
    expect(contentHash).toBeTruthy();
    expect(contentHash.length).toBe(64); // SHA-256 hex

    // Assert performance target
    expect(latency).toBeLessThan(500);
  }, 10000); // 10s timeout for CI

  it("100KB encrypt + store baseline", async () => {
    // Smaller payload for comparison
    const plaintext = Buffer.alloc(100 * 1024); // 100KB

    const startTime = performance.now();
    await storage.put(plaintext, kp.publicKey);
    const endTime = performance.now();

    const latency = endTime - startTime;
    console.log(`  ✓ 100KB encrypt+store: ${latency.toFixed(2)}ms`);

    // 100KB should be much faster (no hard target, just baseline)
    expect(latency).toBeLessThan(200);
  });

  it("10MB encrypt + store stress test", async () => {
    // Larger payload to validate scaling
    const plaintext = Buffer.alloc(10 * 1024 * 1024); // 10MB

    const startTime = performance.now();
    await storage.put(plaintext, kp.publicKey);
    const endTime = performance.now();

    const latency = endTime - startTime;
    console.log(`  ✓ 10MB encrypt+store: ${latency.toFixed(2)}ms`);

    // 10MB target: ~5s (linear scaling from 1MB target)
    expect(latency).toBeLessThan(5000);
  }, 15000); // 15s timeout

  it("measures encryption overhead breakdown", async () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB

    // Isolate encryption time (no storage)
    const { encrypt } = await import("../../src/crypto/encryptor.js");
    const { buildHeader } = await import("../../src/header/serialize.js");
    const { computeFingerprint } = await import(
      "../../src/header/fingerprint.js"
    );
    const { createHash } = await import("crypto");

    const encryptStart = performance.now();
    const ciphertext = encrypt(plaintext, kp.publicKey);
    const encryptEnd = performance.now();

    const fingerprint = computeFingerprint(kp.publicKey);
    const header = buildHeader(
      { algorithm: "TweetNaCl-Box", timestamp: Date.now() },
      fingerprint
    );

    const hashStart = performance.now();
    const blob = Buffer.concat([header, ciphertext]);
    createHash("sha256").update(blob).digest("hex");
    const hashEnd = performance.now();

    const encryptTime = encryptEnd - encryptStart;
    const hashTime = hashEnd - hashStart;

    console.log(`  ✓ Encrypt only: ${encryptTime.toFixed(2)}ms`);
    console.log(`  ✓ Hash only: ${hashTime.toFixed(2)}ms`);

    // Validate encryption is reasonably fast
    expect(encryptTime).toBeLessThan(100);
    expect(hashTime).toBeLessThan(50);
  });
});

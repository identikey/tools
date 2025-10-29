import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import nacl from "tweetnacl";
import {
  EncryptedStorage,
  KeyManager,
} from "../../src/api/encrypted-storage.js";
import { MemoryAdapter } from "../../src/storage/memory-adapter.js";

/**
 * Performance Benchmark: Retrieval + Decryption
 *
 * Measures end-to-end latency for retrieve + decrypt workflow.
 * Uses in-memory storage (no network dependency).
 * Target: 1MB file retrieve + decrypt < 300ms
 *
 * Acceptance Criteria: AC5
 */
describe("Benchmark: Decryption Performance", () => {
  let storage: EncryptedStorage;
  let keyManager: KeyManager;
  let kp: nacl.BoxKeyPair;
  let adapter: MemoryAdapter;
  let contentHash1MB: string;
  let contentHash100KB: string;
  let contentHash10MB: string;

  beforeAll(async () => {
    // Setup in-memory adapter
    adapter = new MemoryAdapter();
    keyManager = new KeyManager();
    storage = new EncryptedStorage(adapter, keyManager);

    kp = nacl.box.keyPair();
    keyManager.addKey(kp.publicKey, kp.secretKey);

    // Pre-store test blobs for retrieval benchmarks
    const data1MB = Buffer.alloc(1024 * 1024);
    contentHash1MB = await storage.put(data1MB, kp.publicKey);

    const data100KB = Buffer.alloc(100 * 1024);
    contentHash100KB = await storage.put(data100KB, kp.publicKey);

    const data10MB = Buffer.alloc(10 * 1024 * 1024);
    contentHash10MB = await storage.put(data10MB, kp.publicKey);
  });

  afterAll(() => {
    // Cleanup in-memory storage
    adapter.clear();
  });

  it("1MB retrieve + decrypt completes in < 300ms", async () => {
    // Measure retrieve + decrypt latency
    const startTime = performance.now();
    const plaintext = await storage.get(contentHash1MB);
    const endTime = performance.now();

    const latency = endTime - startTime;

    console.log(`  ✓ 1MB retrieve+decrypt: ${latency.toFixed(2)}ms`);

    // Verify decryption succeeded
    expect(plaintext).toBeInstanceOf(Buffer);
    expect(plaintext.length).toBe(1024 * 1024);

    // Assert performance target
    expect(latency).toBeLessThan(300);
  }, 10000);

  it("100KB retrieve + decrypt baseline", async () => {
    const startTime = performance.now();
    const plaintext = await storage.get(contentHash100KB);
    const endTime = performance.now();

    const latency = endTime - startTime;
    console.log(`  ✓ 100KB retrieve+decrypt: ${latency.toFixed(2)}ms`);

    expect(plaintext.length).toBe(100 * 1024);
    expect(latency).toBeLessThan(150);
  });

  it("10MB retrieve + decrypt stress test", async () => {
    const startTime = performance.now();
    const plaintext = await storage.get(contentHash10MB);
    const endTime = performance.now();

    const latency = endTime - startTime;
    console.log(`  ✓ 10MB retrieve+decrypt: ${latency.toFixed(2)}ms`);

    expect(plaintext.length).toBe(10 * 1024 * 1024);
    // 10MB target: ~3s (linear scaling from 1MB target)
    expect(latency).toBeLessThan(3000);
  }, 15000);

  it("measures decryption overhead breakdown", async () => {
    // Get blob for analysis (direct adapter access)
    const blob = await adapter.get(contentHash1MB);

    // Parse header
    const { parseHeader } = await import("../../src/header/parse.js");
    const { decrypt } = await import("../../src/crypto/decryptor.js");

    const parseStart = performance.now();
    const { ciphertextOffset } = parseHeader(blob);
    const parseEnd = performance.now();

    const ciphertext = blob.subarray(ciphertextOffset);

    const decryptStart = performance.now();
    decrypt(ciphertext, kp.secretKey);
    const decryptEnd = performance.now();

    const parseTime = parseEnd - parseStart;
    const decryptTime = decryptEnd - decryptStart;

    console.log(`  ✓ Parse header: ${parseTime.toFixed(2)}ms`);
    console.log(`  ✓ Decrypt only: ${decryptTime.toFixed(2)}ms`);

    // Header parsing should be negligible
    expect(parseTime).toBeLessThan(10);
    // Decryption should be fast
    expect(decryptTime).toBeLessThan(100);
  });

  it("repeated retrievals measure cache effects", async () => {
    const iterations = 5;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await storage.get(contentHash1MB);
      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    console.log(`  ✓ Avg latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  ✓ Min latency: ${minLatency.toFixed(2)}ms`);
    console.log(`  ✓ Max latency: ${maxLatency.toFixed(2)}ms`);

    // Average should still meet target
    expect(avgLatency).toBeLessThan(300);
  }, 15000);
});

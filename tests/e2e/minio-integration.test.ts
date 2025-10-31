import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import nacl from "tweetnacl";
import { EncryptedStorage } from "../../src/api/encrypted-storage.js";
import { KeyManager } from "../../src/keypair.js";
import { MinioAdapter } from "../../src/storage/minio-adapter.js";
import type { MinioConfig } from "../../src/types/storage-config.js";

/**
 * End-to-End Test: MinIO Integration
 *
 * Tests real MinIO adapter against a running MinIO server.
 * Requires MinIO to be running and MINIO_ENDPOINT env var set.
 *
 * Run:
 *   docker run -d -p 9000:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data
 *   MINIO_ENDPOINT=localhost bun test tests/e2e/
 *
 * CI: Configured with MinIO service in .github/workflows/ci.yml
 */

// Skip tests if MinIO not configured
const MINIO_AVAILABLE = !!process.env.MINIO_ENDPOINT;
const skipIfNoMinio = MINIO_AVAILABLE ? describe : describe.skip;

skipIfNoMinio("E2E: MinIO Adapter", () => {
  let storage: EncryptedStorage;
  let keyManager: KeyManager;
  let kp: nacl.BoxKeyPair;
  let adapter: MinioAdapter;

  beforeAll(async () => {
    const config: MinioConfig = {
      endpoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
      bucket: "identikey-e2e-test",
    };

    adapter = new MinioAdapter(config);
    keyManager = new KeyManager();
    storage = new EncryptedStorage(adapter, keyManager);

    kp = nacl.box.keyPair();
    keyManager.addKey(kp.publicKey, kp.secretKey);

    // Ensure bucket exists
    await adapter.ensureBucket();
  });

  afterAll(async () => {
    // Cleanup test bucket (optional, comment out for debugging)
    // Note: MinIO adapter doesn't expose bucket deletion
  });

  it("encrypts and uploads to real MinIO server", async () => {
    const plaintext = Buffer.from("End-to-end test data");

    const contentHash = await storage.put(plaintext, kp.publicKey, {
      originalFilename: "e2e-test.txt",
      contentType: "text/plain",
    });

    expect(contentHash).toBeTruthy();
    expect(contentHash.length).toBe(64);
  });

  it("downloads and decrypts from real MinIO server", async () => {
    const plaintext = Buffer.from("Retrieve test data");
    const contentHash = await storage.put(plaintext, kp.publicKey);

    const decrypted = await storage.get(contentHash);

    expect(decrypted.toString()).toBe("Retrieve test data");
  });

  it("verifies blob exists on MinIO", async () => {
    const plaintext = Buffer.from("Exists test");
    const contentHash = await storage.put(plaintext, kp.publicKey);

    const exists = await storage.exists(contentHash);

    expect(exists).toBe(true);
  });

  it("deletes blob from MinIO", async () => {
    const plaintext = Buffer.from("Delete test");
    const contentHash = await storage.put(plaintext, kp.publicKey);

    await storage.delete(contentHash);
    const exists = await storage.exists(contentHash);

    expect(exists).toBe(false);
  });

  it("handles large file (10MB) with MinIO", async () => {
    const plaintext = Buffer.alloc(10 * 1024 * 1024); // 10MB
    for (let i = 0; i < plaintext.length; i += 1024) {
      plaintext[i] = i % 256;
    }

    const startTime = performance.now();
    const contentHash = await storage.put(plaintext, kp.publicKey);
    const uploadTime = performance.now() - startTime;

    console.log(`  ✓ 10MB upload: ${uploadTime.toFixed(2)}ms`);

    const retrieveStart = performance.now();
    const decrypted = await storage.get(contentHash);
    const retrieveTime = performance.now() - retrieveStart;

    console.log(`  ✓ 10MB download: ${retrieveTime.toFixed(2)}ms`);

    expect(decrypted.length).toBe(plaintext.length);
    expect(decrypted[0]).toBe(plaintext[0]);
    expect(decrypted[1024]).toBe(plaintext[1024]);

    // Cleanup large blob
    await storage.delete(contentHash);
  }, 30000); // 30s timeout for large file

  it("handles concurrent uploads to MinIO", async () => {
    const uploads = Array.from({ length: 10 }, (_, i) => {
      const plaintext = Buffer.from(`Concurrent test ${i}`);
      return storage.put(plaintext, kp.publicKey);
    });

    const hashes = await Promise.all(uploads);

    expect(hashes).toHaveLength(10);
    expect(new Set(hashes).size).toBe(10); // All unique hashes

    // Cleanup
    await Promise.all(hashes.map((hash) => storage.delete(hash)));
  });

  it("measures real-world encryption + upload latency", async () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB

    const startTime = performance.now();
    const contentHash = await storage.put(plaintext, kp.publicKey);
    const latency = performance.now() - startTime;

    console.log(`  ✓ Real-world 1MB encrypt+upload: ${latency.toFixed(2)}ms`);

    // AC4: < 500ms target (may vary based on network)
    // Don't assert hard limit for real network, just log
    expect(contentHash).toBeTruthy();

    await storage.delete(contentHash);
  });

  it("measures real-world download + decryption latency", async () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB
    const contentHash = await storage.put(plaintext, kp.publicKey);

    const startTime = performance.now();
    const decrypted = await storage.get(contentHash);
    const latency = performance.now() - startTime;

    console.log(`  ✓ Real-world 1MB download+decrypt: ${latency.toFixed(2)}ms`);

    // AC5: < 300ms target (may vary based on network)
    // Don't assert hard limit for real network, just log
    expect(decrypted.length).toBe(plaintext.length);

    await storage.delete(contentHash);
  });
});

// Info message if MinIO not available
if (!MINIO_AVAILABLE) {
  console.log(
    "\n⏭️  Skipping MinIO E2E tests (MINIO_ENDPOINT not set)\n   To run: docker run -d -p 9000:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data\n"
  );
}

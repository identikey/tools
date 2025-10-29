import { describe, it, expect } from "bun:test";
import { createHash } from "crypto";

/**
 * Performance Benchmark: SHA-256 Hash Computation
 *
 * Measures hash throughput for content-addressable storage.
 * Target: > 100 MB/s hash computation throughput
 *
 * Acceptance Criteria: AC6
 */
describe("Benchmark: Hash Computation Performance", () => {
  it("SHA-256 throughput > 100 MB/s", () => {
    // Test with 100MB buffer
    const bufferSize = 100 * 1024 * 1024; // 100MB
    const buffer = Buffer.alloc(bufferSize);

    // Fill with non-zero data (more realistic than all zeros)
    for (let i = 0; i < bufferSize; i += 1024) {
      buffer.writeUInt32BE(i, i);
    }

    // Measure hash computation time
    const startTime = performance.now();
    const hash = createHash("sha256").update(buffer).digest("hex");
    const endTime = performance.now();

    const durationMs = endTime - startTime;
    const durationSec = durationMs / 1000;
    const throughputMBps = bufferSize / (1024 * 1024) / durationSec;

    console.log(`  ✓ 100MB hashed in: ${durationMs.toFixed(2)}ms`);
    console.log(`  ✓ Throughput: ${throughputMBps.toFixed(2)} MB/s`);

    // Verify hash computed
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64); // SHA-256 hex string

    // Assert performance target
    expect(throughputMBps).toBeGreaterThan(100);
  });

  it("hash computation scales linearly", () => {
    const sizes = [1, 10, 50]; // MB
    const throughputs: number[] = [];

    for (const sizeMB of sizes) {
      const buffer = Buffer.alloc(sizeMB * 1024 * 1024);

      const startTime = performance.now();
      createHash("sha256").update(buffer).digest("hex");
      const endTime = performance.now();

      const durationSec = (endTime - startTime) / 1000;
      const throughput = sizeMB / durationSec;
      throughputs.push(throughput);

      console.log(`  ✓ ${sizeMB}MB: ${throughput.toFixed(2)} MB/s`);
    }

    // Throughput should be relatively consistent (within 50% variance)
    const avgThroughput =
      throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    for (const tp of throughputs) {
      const variance = Math.abs(tp - avgThroughput) / avgThroughput;
      expect(variance).toBeLessThan(0.5); // < 50% variance
    }
  });

  it("incremental hashing performance", () => {
    // Test streaming hash (incremental updates)
    const chunkSize = 1024 * 1024; // 1MB chunks
    const numChunks = 100;
    const chunk = Buffer.alloc(chunkSize);

    const startTime = performance.now();
    const hasher = createHash("sha256");
    for (let i = 0; i < numChunks; i++) {
      hasher.update(chunk);
    }
    const hash = hasher.digest("hex");
    const endTime = performance.now();

    const totalSizeMB = (chunkSize * numChunks) / (1024 * 1024);
    const durationSec = (endTime - startTime) / 1000;
    const throughput = totalSizeMB / durationSec;

    console.log(
      `  ✓ Incremental (${numChunks}x1MB): ${throughput.toFixed(2)} MB/s`
    );

    expect(hash).toBeTruthy();
    expect(throughput).toBeGreaterThan(100);
  });

  it("small blob hashing baseline", () => {
    // Measure overhead for small blobs (typical encrypted storage use case)
    const sizes = [1024, 10 * 1024, 100 * 1024]; // 1KB, 10KB, 100KB
    const latencies: number[] = [];

    for (const size of sizes) {
      const buffer = Buffer.alloc(size);

      const startTime = performance.now();
      createHash("sha256").update(buffer).digest("hex");
      const endTime = performance.now();

      const latency = endTime - startTime;
      latencies.push(latency);

      console.log(`  ✓ ${(size / 1024).toFixed(0)}KB: ${latency.toFixed(3)}ms`);
    }

    // Small blobs should hash very quickly (< 1ms)
    expect(latencies[0]).toBeLessThan(1);
    expect(latencies[1]).toBeLessThan(5);
    expect(latencies[2]).toBeLessThan(10);
  });

  it("compares hash algorithms", () => {
    const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

    // SHA-256 (primary)
    const sha256Start = performance.now();
    createHash("sha256").update(buffer).digest();
    const sha256End = performance.now();
    const sha256Time = sha256End - sha256Start;

    // SHA-512 (comparison)
    const sha512Start = performance.now();
    createHash("sha512").update(buffer).digest();
    const sha512End = performance.now();
    const sha512Time = sha512End - sha512Start;

    // SHA-1 (legacy comparison)
    const sha1Start = performance.now();
    createHash("sha1").update(buffer).digest();
    const sha1End = performance.now();
    const sha1Time = sha1End - sha1Start;

    console.log(`  ✓ SHA-256: ${sha256Time.toFixed(2)}ms`);
    console.log(`  ✓ SHA-512: ${sha512Time.toFixed(2)}ms`);
    console.log(`  ✓ SHA-1: ${sha1Time.toFixed(2)}ms`);

    // SHA-256 should meet target
    const throughput = 10 / (sha256Time / 1000);
    expect(throughput).toBeGreaterThan(100);
  });
});

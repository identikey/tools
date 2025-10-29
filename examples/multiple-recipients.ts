/**
 * IdentiKey Tools - Multiple Recipients Example (FUTURE)
 *
 * This example demonstrates a future pattern for encrypting data for multiple
 * recipients simultaneously (group sharing). Currently, this requires encrypting
 * the same plaintext multiple times (once per recipient).
 *
 * FUTURE ENHANCEMENT:
 * Implement hybrid encryption pattern:
 * 1. Generate random symmetric key (AES-256)
 * 2. Encrypt plaintext with symmetric key
 * 3. Encrypt symmetric key for each recipient (TweetNaCl box)
 * 4. Store: [encrypted_plaintext][recipient1_encrypted_key][recipient2_encrypted_key]...
 *
 * Benefits:
 * - Single encrypted blob for multiple recipients
 * - Efficient: Large files encrypted once, only keys duplicated
 * - Add/remove recipients without re-encrypting plaintext
 *
 * Prerequisites:
 * - MinIO running locally
 */

import nacl from "tweetnacl";
import { EncryptedStorage, KeyManager } from "../src/api/encrypted-storage.js";
import { MinioAdapter } from "../src/storage/minio-adapter.js";
import type { MinioConfig } from "../src/types/storage-config.js";

async function multipleRecipientsExample() {
  console.log(
    "=== IdentiKey Tools - Multiple Recipients Example (FUTURE) ===\n"
  );
  console.log("⚠️  This is a future feature demonstration");
  console.log("⚠️  Current implementation: Encrypt once per recipient\n");

  // Setup storage
  const config: MinioConfig = {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: "identikey-examples",
  };

  const adapter = new MinioAdapter(config);
  await adapter.ensureBucket();

  // Generate keypairs for team members
  console.log("Step 1: Generating keypairs for team members...");
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();
  const charlie = nacl.box.keyPair();

  const keyManager = new KeyManager();
  keyManager.addKey(alice.publicKey, alice.secretKey);
  keyManager.addKey(bob.publicKey, bob.secretKey);
  keyManager.addKey(charlie.publicKey, charlie.secretKey);

  const storage = new EncryptedStorage(adapter, keyManager);
  console.log("  ✓ Team keypairs ready\n");

  // CURRENT APPROACH: Encrypt separately for each recipient
  console.log("Step 2: Current approach (encrypt per recipient)...");
  const plaintext = Buffer.from("Team document - Q4 strategy");

  const hashForAlice = await storage.put(plaintext, alice.publicKey);
  const hashForBob = await storage.put(plaintext, bob.publicKey);
  const hashForCharlie = await storage.put(plaintext, charlie.publicKey);

  console.log(
    "  ✓ Encrypted for Alice:",
    hashForAlice.substring(0, 16) + "..."
  );
  console.log("  ✓ Encrypted for Bob:", hashForBob.substring(0, 16) + "...");
  console.log(
    "  ✓ Encrypted for Charlie:",
    hashForCharlie.substring(0, 16) + "..."
  );
  console.log("  ℹ Storage cost: 3x plaintext size (one copy per recipient)\n");

  // Verify each recipient can decrypt
  console.log("Step 3: Verifying each recipient can decrypt...");
  const decryptedByAlice = await storage.get(hashForAlice);
  const decryptedByBob = await storage.get(hashForBob);
  const decryptedByCharlie = await storage.get(hashForCharlie);

  console.log("  ✓ Alice decrypted successfully");
  console.log("  ✓ Bob decrypted successfully");
  console.log("  ✓ Charlie decrypted successfully\n");

  // FUTURE APPROACH (NOT IMPLEMENTED YET)
  console.log("Step 4: Future approach (hybrid encryption)...");
  console.log("  📋 Planned implementation:");
  console.log("     1. Generate random AES-256 symmetric key");
  console.log("     2. Encrypt plaintext with symmetric key (fast!)");
  console.log("     3. Encrypt symmetric key for each recipient (small!)");
  console.log(
    "     4. Store: [encrypted_data][alice_key][bob_key][charlie_key]"
  );
  console.log("  ");
  console.log("  💡 Benefits:");
  console.log("     - Single encrypted blob (storage efficient)");
  console.log("     - Fast: Large files encrypted once");
  console.log(
    "     - Flexible: Add/remove recipients without re-encrypting data"
  );
  console.log("  ");
  console.log("  🚧 Status: Planned for future release\n");

  // Cleanup
  console.log("Step 5: Cleaning up...");
  await storage.delete(hashForAlice);
  await storage.delete(hashForBob);
  await storage.delete(hashForCharlie);
  console.log("  ✓ Cleanup complete\n");

  // Summary
  console.log("=== Example Complete ===");
  console.log("\nCurrent Pattern:");
  console.log("  - Encrypt once per recipient");
  console.log("  - Simple, secure, works today");
  console.log("  - Trade-off: Storage cost = n × plaintext size");
  console.log("\nFuture Pattern:");
  console.log("  - Hybrid encryption (symmetric + asymmetric)");
  console.log("  - Single encrypted blob for all recipients");
  console.log("  - Storage cost = plaintext + (n × 32 bytes)");
  console.log("  - Efficient for large files with many recipients");
  console.log("\nImplementation Notes:");
  console.log("  - Requires new header format (v2)");
  console.log(
    "  - Need symmetric encryption primitive (AES-256-GCM or ChaCha20-Poly1305)"
  );
  console.log("  - Backward compatibility via version byte in header");
  console.log("  - See docs/architecture/ for detailed design\n");
}

// Run example
multipleRecipientsExample().catch((err) => {
  console.error("\n✗ Example failed:", err.message);
  if (err.message.includes("ECONNREFUSED")) {
    console.log("\nPlease start MinIO:");
    console.log("  docker run -d -p 9000:9000 -p 9001:9001 \\");
    console.log("    -e MINIO_ROOT_USER=minioadmin \\");
    console.log("    -e MINIO_ROOT_PASSWORD=minioadmin \\");
    console.log("    minio/minio server /data --console-address ':9001'");
  }
  process.exit(1);
});

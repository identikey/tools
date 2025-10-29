/**
 * IdentiKey Tools - Basic Usage Example
 *
 * Demonstrates complete workflow:
 * 1. Generate keypair
 * 2. Setup encrypted storage
 * 3. Encrypt and store file
 * 4. Retrieve and decrypt file
 * 5. Verify content integrity
 *
 * Prerequisites:
 * - MinIO running locally (docker-compose up -d)
 * - Environment variables set (or use defaults)
 */

import nacl from "tweetnacl";
import { EncryptedStorage, KeyManager } from "../src/api/encrypted-storage.js";
import { MinioAdapter } from "../src/storage/minio-adapter.js";
import type { MinioConfig } from "../src/types/storage-config.js";

async function basicUsageExample() {
  console.log("=== IdentiKey Tools - Basic Usage Example ===\n");

  // Step 1: Generate Curve25519 keypair for encryption
  console.log("Step 1: Generating keypair...");
  const keypair = nacl.box.keyPair();

  console.log(
    "  ✓ Public key:",
    Buffer.from(keypair.publicKey).toString("hex").substring(0, 16) + "..."
  );
  console.log("  ✓ Private key: (keep secret!)\n");

  // Step 2: Configure storage backend
  console.log("Step 2: Configuring storage backend...");
  const config: MinioConfig = {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: "identikey-examples",
  };

  const adapter = new MinioAdapter(config);
  const keyManager = new KeyManager();
  keyManager.addKey(keypair.publicKey, keypair.secretKey);

  const storage = new EncryptedStorage(adapter, keyManager);

  // Ensure bucket exists
  try {
    await adapter.ensureBucket();
    console.log("  ✓ Storage backend ready\n");
  } catch (err) {
    console.error("  ✗ MinIO not available:", err);
    console.log("\nPlease start MinIO:");
    console.log("  docker run -d -p 9000:9000 -p 9001:9001 \\");
    console.log("    -e MINIO_ROOT_USER=minioadmin \\");
    console.log("    -e MINIO_ROOT_PASSWORD=minioadmin \\");
    console.log("    minio/minio server /data --console-address ':9001'");
    process.exit(1);
  }

  // Step 3: Encrypt and store data
  console.log("Step 3: Encrypting and storing file...");
  const plaintext = Buffer.from(
    "This is secret data protected by TweetNaCl encryption. " +
      "Only the holder of the private key can decrypt this content."
  );

  const contentHash = await storage.put(plaintext, keypair.publicKey, {
    originalFilename: "secret.txt",
    contentType: "text/plain",
    plaintextChecksum: require("crypto")
      .createHash("sha256")
      .update(plaintext)
      .digest("hex"),
  });

  console.log("  ✓ Encrypted and stored");
  console.log("  ✓ Content hash:", contentHash);
  console.log("  ✓ Size:", plaintext.length, "bytes\n");

  // Step 4: Retrieve and decrypt
  console.log("Step 4: Retrieving and decrypting...");
  const decrypted = await storage.get(contentHash);

  console.log("  ✓ Retrieved and decrypted");
  console.log(
    "  ✓ Decrypted content:",
    decrypted.toString().substring(0, 50) + "..."
  );
  console.log("  ✓ Size:", decrypted.length, "bytes\n");

  // Step 5: Verify integrity
  console.log("Step 5: Verifying integrity...");
  const match = plaintext.equals(decrypted);

  if (match) {
    console.log("  ✓ Content integrity verified (plaintext === decrypted)\n");
  } else {
    console.error("  ✗ Integrity check FAILED!\n");
    process.exit(1);
  }

  // Step 6: Demonstrate metadata retrieval
  console.log("Step 6: Retrieving metadata without decryption...");
  const metadata = await storage.getMetadata(contentHash);

  console.log("  ✓ Algorithm:", metadata.algorithm);
  console.log("  ✓ Timestamp:", new Date(metadata.timestamp).toISOString());
  console.log("  ✓ Filename:", metadata.originalFilename);
  console.log("  ✓ Content type:", metadata.contentType);
  console.log(
    "  ✓ Checksum:",
    metadata.plaintextChecksum?.substring(0, 16) + "...\n"
  );

  // Step 7: Check existence
  console.log("Step 7: Checking blob existence...");
  const exists = await storage.exists(contentHash);
  console.log("  ✓ Blob exists:", exists, "\n");

  // Step 8: Cleanup
  console.log("Step 8: Cleaning up...");
  await storage.delete(contentHash);

  const existsAfterDelete = await storage.exists(contentHash);
  console.log("  ✓ Blob deleted");
  console.log("  ✓ Exists after delete:", existsAfterDelete, "\n");

  // Summary
  console.log("=== Example Complete ===");
  console.log("\nKey Takeaways:");
  console.log(
    "  1. Content-addressable storage uses SHA-256 hashes for retrieval"
  );
  console.log("  2. TweetNaCl box provides authenticated encryption (AEAD)");
  console.log("  3. Metadata can be retrieved without decrypting ciphertext");
  console.log("  4. Storage backend never sees plaintext (zero-knowledge)");
  console.log("\nNext Steps:");
  console.log("  - See examples/key-management.ts for KeyManager patterns");
  console.log("  - See docs/architecture/ for detailed design documentation");
  console.log("  - See docs/deployment-guide.md for production deployment\n");
}

// Run example
basicUsageExample().catch((err) => {
  console.error("\n✗ Example failed:", err.message);
  process.exit(1);
});

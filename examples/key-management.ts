/**
 * IdentiKey Tools - Key Management Example
 *
 * Demonstrates KeyManager usage patterns:
 * 1. Adding multiple keypairs
 * 2. Key fingerprinting and lookup
 * 3. Multi-key scenarios (different recipients)
 * 4. Key rotation patterns
 *
 * Prerequisites:
 * - MinIO running locally
 */

import nacl from "tweetnacl";
import { EncryptedStorage, KeyManager } from "../src/api/encrypted-storage.js";
import { computeFingerprint } from "../src/header/fingerprint.js";
import { MinioAdapter } from "../src/storage/minio-adapter.js";
import type { MinioConfig } from "../src/types/storage-config.js";

async function keyManagementExample() {
  console.log("=== IdentiKey Tools - Key Management Example ===\n");

  // Scenario: Multiple recipients (e.g., team members, devices, services)
  console.log("Scenario: Managing keys for multiple recipients\n");

  // Generate keypairs for 3 different recipients
  console.log("Step 1: Generating keypairs for 3 recipients...");
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();
  const charlie = nacl.box.keyPair();

  const aliceFingerprint = computeFingerprint(alice.publicKey);
  const bobFingerprint = computeFingerprint(bob.publicKey);
  const charlieFingerprint = computeFingerprint(charlie.publicKey);

  console.log("  ✓ Alice fingerprint:", aliceFingerprint);
  console.log("  ✓ Bob fingerprint:", bobFingerprint);
  console.log("  ✓ Charlie fingerprint:", charlieFingerprint, "\n");

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

  // Create KeyManager and add all keys
  console.log("Step 2: Adding keys to KeyManager...");
  const keyManager = new KeyManager();

  keyManager.addKey(alice.publicKey, alice.secretKey);
  keyManager.addKey(bob.publicKey, bob.secretKey);
  keyManager.addKey(charlie.publicKey, charlie.secretKey);

  console.log("  ✓ Added 3 keys to KeyManager");
  console.log("  ✓ Has Alice's key:", keyManager.hasKey(aliceFingerprint));
  console.log("  ✓ Has Bob's key:", keyManager.hasKey(bobFingerprint));
  console.log(
    "  ✓ Has Charlie's key:",
    keyManager.hasKey(charlieFingerprint),
    "\n"
  );

  const storage = new EncryptedStorage(adapter, keyManager);

  // Encrypt data for different recipients
  console.log("Step 3: Encrypting data for each recipient...");
  const plaintext = Buffer.from("Shared team secret");

  const hashForAlice = await storage.put(plaintext, alice.publicKey, {
    originalFilename: "team-secret-alice.txt",
  });

  const hashForBob = await storage.put(plaintext, bob.publicKey, {
    originalFilename: "team-secret-bob.txt",
  });

  const hashForCharlie = await storage.put(plaintext, charlie.publicKey, {
    originalFilename: "team-secret-charlie.txt",
  });

  console.log(
    "  ✓ Encrypted for Alice:",
    hashForAlice.substring(0, 16) + "..."
  );
  console.log("  ✓ Encrypted for Bob:", hashForBob.substring(0, 16) + "...");
  console.log(
    "  ✓ Encrypted for Charlie:",
    hashForCharlie.substring(0, 16) + "..."
  );
  console.log(
    "  ℹ Note: Same plaintext produces different hashes (random ephemeral keys)\n"
  );

  // Decrypt with automatic key lookup
  console.log("Step 4: Decrypting with automatic key lookup...");

  const decryptedByAlice = await storage.get(hashForAlice);
  console.log("  ✓ Alice decrypted:", decryptedByAlice.toString());

  const decryptedByBob = await storage.get(hashForBob);
  console.log("  ✓ Bob decrypted:", decryptedByBob.toString());

  const decryptedByCharlie = await storage.get(hashForCharlie);
  console.log("  ✓ Charlie decrypted:", decryptedByCharlie.toString(), "\n");

  // Demonstrate explicit key usage (bypass KeyManager)
  console.log("Step 5: Explicit key usage (bypass KeyManager)...");

  const decryptedExplicit = await storage.get(hashForAlice, alice.secretKey);
  console.log(
    "  ✓ Decrypted with explicit key:",
    decryptedExplicit.toString(),
    "\n"
  );

  // Demonstrate key not found error
  console.log("Step 6: Demonstrating key not found error...");

  const unknownKeyPair = nacl.box.keyPair();
  const unknownFingerprint = computeFingerprint(unknownKeyPair.publicKey);

  try {
    keyManager.getPrivateKey(unknownFingerprint);
    console.error("  ✗ Should have thrown error!");
  } catch (err) {
    console.log("  ✓ Correctly threw error:", (err as Error).message, "\n");
  }

  // Demonstrate wrong key decryption failure
  console.log("Step 7: Demonstrating wrong key decryption failure...");

  try {
    await storage.get(hashForAlice, bob.secretKey);
    console.error("  ✗ Should have failed!");
  } catch (err) {
    console.log("  ✓ Correctly failed:", (err as Error).message, "\n");
  }

  // Key rotation pattern
  console.log("Step 8: Key rotation pattern...");
  console.log("  ℹ Scenario: Alice gets a new device with new keypair");

  const aliceNewDevice = nacl.box.keyPair();
  const aliceNewFingerprint = computeFingerprint(aliceNewDevice.publicKey);

  // Add new key
  keyManager.addKey(aliceNewDevice.publicKey, aliceNewDevice.secretKey);
  console.log("  ✓ Added Alice's new key:", aliceNewFingerprint);

  // Encrypt with new key
  const hashForAliceNew = await storage.put(
    plaintext,
    aliceNewDevice.publicKey,
    {
      originalFilename: "team-secret-alice-new.txt",
    }
  );

  // Both old and new keys work
  const decryptedWithOld = await storage.get(hashForAlice); // Uses old key
  const decryptedWithNew = await storage.get(hashForAliceNew); // Uses new key

  console.log("  ✓ Old key still works:", decryptedWithOld.toString());
  console.log("  ✓ New key works:", decryptedWithNew.toString());
  console.log("  ℹ Old blobs remain accessible during transition\n");

  // Cleanup
  console.log("Step 9: Cleaning up...");
  await storage.delete(hashForAlice);
  await storage.delete(hashForBob);
  await storage.delete(hashForCharlie);
  await storage.delete(hashForAliceNew);
  console.log("  ✓ Cleanup complete\n");

  // Summary
  console.log("=== Example Complete ===");
  console.log("\nKey Management Patterns:");
  console.log(
    "  1. KeyManager indexes keys by public key fingerprint (SHA-256 + Base58)"
  );
  console.log(
    "  2. Multiple keys can coexist (team members, devices, services)"
  );
  console.log(
    "  3. Automatic key lookup during decryption (via header fingerprint)"
  );
  console.log(
    "  4. Explicit key usage available (bypass KeyManager for specific keys)"
  );
  console.log("  5. Key rotation: Add new key, keep old key during transition");
  console.log("\nBest Practices:");
  console.log("  - Generate unique keypairs per device/service");
  console.log(
    "  - Store private keys securely (OS keychain, hardware security module)"
  );
  console.log("  - Rotate keys periodically (90-180 day cycle)");
  console.log(
    "  - Maintain old keys during transition for backward compatibility\n"
  );
}

// Run example
keyManagementExample().catch((err) => {
  console.error("\n✗ Example failed:", err.message);
  process.exit(1);
});

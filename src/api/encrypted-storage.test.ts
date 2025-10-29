import { describe, it, expect } from "bun:test";
import nacl from "tweetnacl";
import { KeyManager, EncryptedStorage } from "./encrypted-storage.js";
import { computeFingerprint } from "../header/fingerprint.js";
import type { StorageAdapter } from "../storage/adapter.js";

describe("KeyManager", () => {
  it("stores and retrieves keys by fingerprint", () => {
    const km = new KeyManager();
    const keypair = nacl.box.keyPair();
    const fingerprint = computeFingerprint(keypair.publicKey);

    km.addKey(keypair.publicKey, keypair.secretKey);

    const retrieved = km.getPrivateKey(fingerprint);
    expect(retrieved).toEqual(keypair.secretKey);
  });

  it("throws descriptive error for missing key", () => {
    const km = new KeyManager();
    const fakeFingerprint = "a".repeat(44);

    expect(() => {
      km.getPrivateKey(fakeFingerprint);
    }).toThrow("Private key not found");
    expect(() => {
      km.getPrivateKey(fakeFingerprint);
    }).toThrow(fakeFingerprint);
  });

  it("hasKey returns correct boolean", () => {
    const km = new KeyManager();
    const keypair = nacl.box.keyPair();
    const fingerprint = computeFingerprint(keypair.publicKey);

    expect(km.hasKey(fingerprint)).toBe(false);

    km.addKey(keypair.publicKey, keypair.secretKey);

    expect(km.hasKey(fingerprint)).toBe(true);
  });
});

describe("EncryptedStorage", () => {
  // Create mock storage adapter
  class MockStorage implements StorageAdapter {
    private store = new Map<string, Buffer>();

    async put(key: string, data: Buffer): Promise<void> {
      this.store.set(key, data);
    }

    async get(key: string): Promise<Buffer> {
      const data = this.store.get(key);
      if (!data) throw new Error(`Key not found: ${key}`);
      return data;
    }

    async exists(key: string): Promise<boolean> {
      return this.store.has(key);
    }

    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  it("put encrypts and stores blob, returns content hash", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("secret data");

    const contentHash = await es.put(plaintext, keypair.publicKey);

    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await storage.exists(contentHash)).toBe(true);
  });

  it("get retrieves and decrypts blob with explicit key", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("secret data");

    const contentHash = await es.put(plaintext, keypair.publicKey);
    const decrypted = await es.get(contentHash, keypair.secretKey);

    expect(decrypted).toEqual(plaintext);
  });

  it("get retrieves and decrypts blob with KeyManager lookup", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    km.addKey(keypair.publicKey, keypair.secretKey);

    const plaintext = Buffer.from("secret data");
    const contentHash = await es.put(plaintext, keypair.publicKey);

    // Decrypt without providing private key - should lookup via fingerprint
    const decrypted = await es.get(contentHash);

    expect(decrypted).toEqual(plaintext);
  });

  it("getMetadata returns metadata without decrypting", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("test");
    const metadata = {
      originalFilename: "test.txt",
      contentType: "text/plain",
    };

    const contentHash = await es.put(plaintext, keypair.publicKey, metadata);
    const retrieved = await es.getMetadata(contentHash);

    expect(retrieved.algorithm).toBe("TweetNaCl-Box");
    expect(retrieved.originalFilename).toBe("test.txt");
    expect(retrieved.contentType).toBe("text/plain");
    expect(retrieved.timestamp).toBeGreaterThan(0);
  });

  it("exists proxies to storage backend", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("test");

    const contentHash = await es.put(plaintext, keypair.publicKey);

    expect(await es.exists(contentHash)).toBe(true);
    expect(await es.exists("fakehash")).toBe(false);
  });

  it("delete proxies to storage backend", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("test");

    const contentHash = await es.put(plaintext, keypair.publicKey);
    expect(await es.exists(contentHash)).toBe(true);

    await es.delete(contentHash);
    expect(await es.exists(contentHash)).toBe(false);
  });

  it("throws when private key not found in KeyManager", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    const plaintext = Buffer.from("test");

    const contentHash = await es.put(plaintext, keypair.publicKey);

    // Try to get without adding key to KeyManager
    await expect(es.get(contentHash)).rejects.toThrow("Private key not found");
  });

  it("verifies plaintext checksum if present", async () => {
    const storage = new MockStorage();
    const km = new KeyManager();
    const es = new EncryptedStorage(storage, km);

    const keypair = nacl.box.keyPair();
    km.addKey(keypair.publicKey, keypair.secretKey);

    const plaintext = Buffer.from("test data");
    const checksum = require("crypto")
      .createHash("sha256")
      .update(plaintext)
      .digest("hex");

    const contentHash = await es.put(plaintext, keypair.publicKey, {
      plaintextChecksum: checksum,
    });

    const decrypted = await es.get(contentHash);
    expect(decrypted).toEqual(plaintext);
  });
});

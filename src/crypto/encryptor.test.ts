import { describe, it, expect } from "bun:test";
import nacl from "tweetnacl";
import { encrypt } from "./encryptor.js";

describe("encryptor", () => {
  describe("encrypt", () => {
    it("encrypts plaintext and returns Buffer", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("hello world");

      const result = encrypt(plaintext, keypair.publicKey);

      expect(result).toBeInstanceOf(Buffer);
      // Should contain: ephemeral public (32) + nonce (24) + ciphertext (at least plaintext length + MAC overhead)
      expect(result.length).toBeGreaterThan(32 + 24 + plaintext.length);
    });

    it("produces different output for same input (nonce randomness)", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("same message");

      const ct1 = encrypt(plaintext, keypair.publicKey);
      const ct2 = encrypt(plaintext, keypair.publicKey);

      expect(ct1).not.toEqual(ct2);
      // But both should have valid structure
      expect(ct1.length).toBeGreaterThan(56);
      expect(ct2.length).toBeGreaterThan(56);
    });

    it("encrypts empty plaintext", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("");

      const result = encrypt(plaintext, keypair.publicKey);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(56); // ephemeral + nonce + MAC overhead
    });

    it("encrypts large plaintext", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.alloc(1024 * 100, "a"); // 100KB

      const result = encrypt(plaintext, keypair.publicKey);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(plaintext.length + 56);
    });
  });
});

import { describe, it, expect } from "bun:test";
import nacl from "tweetnacl";
import { encrypt } from "./encryptor.js";
import { decrypt } from "./decryptor.js";

describe("decryptor", () => {
  describe("decrypt", () => {
    it("decrypts valid ciphertext and returns original plaintext", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("secret message");

      const ciphertext = encrypt(plaintext, keypair.publicKey);
      const decrypted = decrypt(ciphertext, keypair.secretKey);

      expect(decrypted).toEqual(plaintext);
    });

    it("handles empty plaintext round-trip", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("");

      const ciphertext = encrypt(plaintext, keypair.publicKey);
      const decrypted = decrypt(ciphertext, keypair.secretKey);

      expect(decrypted).toEqual(plaintext);
    });

    it("handles large plaintext round-trip", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.alloc(1024 * 100, "x"); // 100KB

      const ciphertext = encrypt(plaintext, keypair.publicKey);
      const decrypted = decrypt(ciphertext, keypair.secretKey);

      expect(decrypted).toEqual(plaintext);
    });

    it("rejects tampered ciphertext", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("authentic message");
      const ciphertext = encrypt(plaintext, keypair.publicKey);

      // Tamper with the ciphertext (flip a bit in the encrypted data section)
      const byteToFlip = ciphertext[60];
      if (byteToFlip !== undefined) {
        ciphertext[60] = byteToFlip ^ 0xff;
      }

      expect(() => {
        decrypt(ciphertext, keypair.secretKey);
      }).toThrow("Decryption failed");
    });

    it("rejects wrong secret key", () => {
      const keypair1 = nacl.box.keyPair();
      const keypair2 = nacl.box.keyPair();
      const plaintext = Buffer.from("private data");

      const ciphertext = encrypt(plaintext, keypair1.publicKey);

      expect(() => {
        decrypt(ciphertext, keypair2.secretKey);
      }).toThrow("Decryption failed");
    });

    it("rejects truncated ciphertext", () => {
      const keypair = nacl.box.keyPair();
      const plaintext = Buffer.from("test");
      const ciphertext = encrypt(plaintext, keypair.publicKey);

      // Truncate before minimum length
      const truncated = ciphertext.subarray(0, 50);

      expect(() => {
        decrypt(truncated, keypair.secretKey);
      }).toThrow(); // Will throw either "bad nonce size" or "Decryption failed"
    });
  });
});

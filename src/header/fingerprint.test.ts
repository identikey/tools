import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { computeFingerprint } from "./fingerprint.js";

describe("fingerprint", () => {
  describe("computeFingerprint", () => {
    it("computes SHA-256 hash and returns Base58 string (~44 chars)", () => {
      const keypair = nacl.box.keyPair();

      const fingerprint = computeFingerprint(keypair.publicKey);

      expect(fingerprint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
      expect(fingerprint.length).toBeGreaterThanOrEqual(43);
      expect(fingerprint.length).toBeLessThanOrEqual(44);
    });

    it("produces same fingerprint for same public key (deterministic)", () => {
      const keypair = nacl.box.keyPair();

      const fp1 = computeFingerprint(keypair.publicKey);
      const fp2 = computeFingerprint(keypair.publicKey);

      expect(fp1).toBe(fp2);
    });

    it("produces different fingerprints for different public keys", () => {
      const kp1 = nacl.box.keyPair();
      const kp2 = nacl.box.keyPair();

      const fp1 = computeFingerprint(kp1.publicKey);
      const fp2 = computeFingerprint(kp2.publicKey);

      expect(fp1).not.toBe(fp2);
      expect(fp1.length).toBeGreaterThanOrEqual(43);
      expect(fp2.length).toBeGreaterThanOrEqual(43);
    });

    it("handles edge case: all-zero public key", () => {
      const zeroKey = new Uint8Array(32);

      const fingerprint = computeFingerprint(zeroKey);

      expect(fingerprint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
      expect(fingerprint.length).toBeGreaterThanOrEqual(43);
      // SHA-256 of 32 zero bytes in Base58 has known value
      expect(fingerprint).toBe("7tkzFg8RHBmMw1ncRJZCCZAizgq4rwCftTKYLce8RU8t");
    });

    it("produces unique fingerprints across many keypairs (collision-free)", () => {
      const fingerprints = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const kp = nacl.box.keyPair();
        const fp = computeFingerprint(kp.publicKey);
        expect(fp).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
        fingerprints.add(fp);
      }

      // All fingerprints should be unique
      expect(fingerprints.size).toBe(100);
    });
  });
});

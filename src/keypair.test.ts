import { describe, it, expect } from "bun:test";
import {
  generateKeyPair,
  toHex,
  toBase64,
  toBase58,
  fromHex,
  fromBase64,
  fromBase58,
} from "./keypair.js";

describe("keypair", () => {
  describe("generateKeyPair", () => {
    it("generates a valid Curve25519 keypair", () => {
      const kp = generateKeyPair();

      expect(kp.publicKey).toBeInstanceOf(Uint8Array);
      expect(kp.secretKey).toBeInstanceOf(Uint8Array);
      expect(kp.publicKey.length).toBe(32);
      expect(kp.secretKey.length).toBe(32);
    });

    it("generates unique keys on each call", () => {
      const kp1 = generateKeyPair();
      const kp2 = generateKeyPair();

      expect(kp1.publicKey).not.toEqual(kp2.publicKey);
      expect(kp1.secretKey).not.toEqual(kp2.secretKey);
    });
  });

  describe("serialization", () => {
    const testBytes = new Uint8Array([1, 2, 3, 4, 255]);

    it("converts to/from hex", () => {
      const hex = toHex(testBytes);
      expect(hex).toBe("01020304ff");
      expect(fromHex(hex)).toEqual(testBytes);
    });

    it("converts to/from base64", () => {
      const b64 = toBase64(testBytes);
      expect(b64).toBe("AQIDBP8=");
      expect(fromBase64(b64)).toEqual(testBytes);
    });

    it("converts to/from base58", () => {
      const b58 = toBase58(testBytes);
      expect(b58).toBe("7bWpXp");
      expect(fromBase58(b58)).toEqual(testBytes);
    });

    it("round-trips real keypair data", () => {
      const kp = generateKeyPair();

      const hexPub = toHex(kp.publicKey);
      const b64Sec = toBase64(kp.secretKey);
      const b58Pub = toBase58(kp.publicKey);

      expect(fromHex(hexPub)).toEqual(kp.publicKey);
      expect(fromBase64(b64Sec)).toEqual(kp.secretKey);
      expect(fromBase58(b58Pub)).toEqual(kp.publicKey);
    });
  });
});

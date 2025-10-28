import nacl from "tweetnacl";
import bs58 from "bs58";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

// Serialization helpers
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function toBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

// Deserialization helpers
export function fromHex(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "hex"));
}

export function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

export function fromBase58(str: string): Uint8Array {
  return bs58.decode(str);
}

export function generateKey(): KeyPair {
  return nacl.sign.keyPair();
}

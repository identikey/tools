import nacl from "tweetnacl";

/**
 * Decrypts ciphertext using TweetNaCl box.open (Curve25519 + XSalsa20-Poly1305).
 *
 * @param ciphertext - Buffer containing [ephemeralPublicKey: 32B][nonce: 24B][ciphertext: variable]
 * @param recipientSecretKey - The recipient's Curve25519 secret key (32 bytes)
 * @returns The original plaintext
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
export function decrypt(
  ciphertext: Buffer,
  recipientSecretKey: Uint8Array
): Buffer {
  // Extract components
  const ephemeralPublicKey = new Uint8Array(ciphertext.subarray(0, 32));
  const nonce = new Uint8Array(ciphertext.subarray(32, 56));
  const encryptedData = new Uint8Array(ciphertext.subarray(56));

  // Decrypt: box.open(ciphertext, nonce, theirPublic, mySecret)
  const plaintext = nacl.box.open(
    encryptedData,
    nonce,
    ephemeralPublicKey,
    recipientSecretKey
  );

  if (!plaintext) {
    throw new Error("Decryption failed: invalid key or corrupted ciphertext");
  }

  return Buffer.from(plaintext);
}

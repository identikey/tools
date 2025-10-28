import nacl from "tweetnacl";

/**
 * Encrypts plaintext for a recipient's public key using TweetNaCl box (Curve25519 + XSalsa20-Poly1305).
 *
 * @param plaintext - The data to encrypt
 * @param recipientPublicKey - The recipient's Curve25519 public key (32 bytes)
 * @returns Buffer containing [ephemeralPublicKey: 32B][nonce: 24B][ciphertext: variable]
 */
export function encrypt(
  plaintext: Buffer,
  recipientPublicKey: Uint8Array
): Buffer {
  // Generate ephemeral keypair for this encryption
  const ephemeral = nacl.box.keyPair();

  // Generate random nonce
  const nonce = nacl.randomBytes(24);

  // Encrypt: box(message, nonce, theirPublic, mySecret)
  const ciphertext = nacl.box(
    new Uint8Array(plaintext),
    nonce,
    recipientPublicKey,
    ephemeral.secretKey
  );

  // Concatenate ephemeralPublic + nonce + ciphertext
  const result = Buffer.concat([
    Buffer.from(ephemeral.publicKey),
    Buffer.from(nonce),
    Buffer.from(ciphertext),
  ]);

  return result;
}

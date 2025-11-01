import { argon2id } from '@noble/hashes/argon2';
import { randomBytes } from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const { secretbox } = nacl;

/**
 * Encrypted key file format
 */
export interface EncryptedKeyFile {
  version: number;
  publicKey: string;  // Base58 encoded
  privateKey: string;  // Encrypted, Base64 encoded
  salt: string;        // Base64 encoded (16 bytes)
  nonce: string;       // Base64 encoded (24 bytes)
  fingerprint: string; // Hex string
}

/**
 * KDF parameters for Argon2id
 */
const ARGON2_PARAMS = {
  m: 65536,        // 64MB memory
  t: 3,            // 3 iterations
  p: 1,            // parallelism = 1
  dkLen: 32,       // 32 bytes output (256 bits for XSalsa20-Poly1305)
};

/**
 * Encrypt a private key with a passphrase using Argon2id + XSalsa20-Poly1305
 */
export function encryptPrivateKey(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  passphrase: string,
  fingerprint: string
): EncryptedKeyFile {
  // Generate cryptographically random salt and nonce
  const salt = randomBytes(16);
  const nonce = randomBytes(24);

  // Derive encryption key from passphrase using Argon2id
  const derivedKey = argon2id(
    Buffer.from(passphrase, 'utf-8'),
    salt,
    ARGON2_PARAMS
  );

  // Encrypt private key with XSalsa20-Poly1305
  const encrypted = secretbox(privateKey, nonce, derivedKey);

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    version: 1,
    publicKey: bs58.encode(publicKey),
    privateKey: Buffer.from(encrypted).toString('base64'),
    salt: salt.toString('base64'),
    nonce: nonce.toString('base64'),
    fingerprint,
  };
}

/**
 * Decrypt a private key with a passphrase
 */
export function decryptPrivateKey(
  encryptedKeyFile: EncryptedKeyFile,
  passphrase: string
): Uint8Array {
  if (encryptedKeyFile.version !== 1) {
    throw new Error(`Unsupported key file version: ${encryptedKeyFile.version}`);
  }

  // Decode salt and nonce
  const salt = Buffer.from(encryptedKeyFile.salt, 'base64');
  const nonce = Buffer.from(encryptedKeyFile.nonce, 'base64');

  // Validate salt and nonce lengths
  if (salt.length !== 16) {
    throw new Error(`Invalid salt length: expected 16, got ${salt.length}`);
  }
  if (nonce.length !== 24) {
    throw new Error(`Invalid nonce length: expected 24, got ${nonce.length}`);
  }

  // Derive decryption key from passphrase using same parameters
  const derivedKey = argon2id(
    Buffer.from(passphrase, 'utf-8'),
    salt,
    ARGON2_PARAMS
  );

  // Decrypt private key
  const encrypted = Buffer.from(encryptedKeyFile.privateKey, 'base64');
  const decrypted = secretbox.open(new Uint8Array(encrypted), nonce, derivedKey);

  if (!decrypted) {
    throw new Error('Decryption failed. Wrong passphrase or corrupted key file.');
  }

  return decrypted;
}

/**
 * Decode public key from Base58
 */
export function decodePublicKey(base58PublicKey: string): Uint8Array {
  return bs58.decode(base58PublicKey);
}


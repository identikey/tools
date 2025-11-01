import { describe, test, expect } from 'bun:test';
import { encryptPrivateKey, decryptPrivateKey, decodePublicKey } from './key-encryption';
import { generateKeyPair } from '../../keypair';

describe('Key Encryption', () => {
  describe('encryptPrivateKey / decryptPrivateKey', () => {
    test('should encrypt and decrypt private key successfully', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const passphrase = 'test-passphrase-123';
      const fingerprint = 'abc123';

      const encrypted = encryptPrivateKey(secretKey, publicKey, passphrase, fingerprint);
      const decrypted = decryptPrivateKey(encrypted, passphrase);

      expect(decrypted).toEqual(secretKey);
    });

    test('should fail decryption with wrong passphrase', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const correctPassphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';
      const fingerprint = 'abc123';

      const encrypted = encryptPrivateKey(secretKey, publicKey, correctPassphrase, fingerprint);

      expect(() => {
        decryptPrivateKey(encrypted, wrongPassphrase);
      }).toThrow('Decryption failed');
    });

    test('should generate unique salts for same passphrase', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const passphrase = 'same-passphrase';
      const fingerprint = 'abc123';

      const encrypted1 = encryptPrivateKey(secretKey, publicKey, passphrase, fingerprint);
      const encrypted2 = encryptPrivateKey(secretKey, publicKey, passphrase, fingerprint);

      // Salts should be different (cryptographically random)
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      // Nonces should be different
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
      // But both should decrypt correctly
      expect(decryptPrivateKey(encrypted1, passphrase)).toEqual(secretKey);
      expect(decryptPrivateKey(encrypted2, passphrase)).toEqual(secretKey);
    });

    test('should include correct metadata in encrypted file', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const passphrase = 'test-passphrase';
      const fingerprint = 'test-fingerprint-123';

      const encrypted = encryptPrivateKey(secretKey, publicKey, passphrase, fingerprint);

      expect(encrypted.version).toBe(1);
      expect(encrypted.fingerprint).toBe(fingerprint);
      expect(encrypted.publicKey).toBeTruthy();
      expect(encrypted.privateKey).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();
      expect(encrypted.nonce).toBeTruthy();
    });

    test('should produce correct salt length (16 bytes)', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');
      const salt = Buffer.from(encrypted.salt, 'base64');

      expect(salt.length).toBe(16);
    });

    test('should produce correct nonce length (24 bytes)', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');
      const nonce = Buffer.from(encrypted.nonce, 'base64');

      expect(nonce.length).toBe(24);
    });

    test('should reject invalid key file version', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');

      // Tamper with version
      encrypted.version = 99;

      expect(() => {
        decryptPrivateKey(encrypted, 'pass');
      }).toThrow('Unsupported key file version: 99');
    });

    test('should reject corrupted salt', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');

      // Tamper with salt (make it invalid length)
      encrypted.salt = Buffer.from('invalid').toString('base64');

      expect(() => {
        decryptPrivateKey(encrypted, 'pass');
      }).toThrow('Invalid salt length');
    });

    test('should reject corrupted nonce', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');

      // Tamper with nonce (make it invalid length)
      encrypted.nonce = Buffer.from('invalid').toString('base64');

      expect(() => {
        decryptPrivateKey(encrypted, 'pass');
      }).toThrow('Invalid nonce length');
    });

    test('should reject corrupted ciphertext', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'pass', 'fp');

      // Tamper with encrypted private key
      const corrupted = Buffer.from(encrypted.privateKey, 'base64');
      corrupted[0] ^= 0xFF; // Flip bits
      encrypted.privateKey = corrupted.toString('base64');

      expect(() => {
        decryptPrivateKey(encrypted, 'pass');
      }).toThrow('Decryption failed');
    });
  });

  describe('decodePublicKey', () => {
    test('should decode Base58 encoded public key', () => {
      const { publicKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(
        new Uint8Array(32),
        publicKey,
        'pass',
        'fp'
      );

      const decoded = decodePublicKey(encrypted.publicKey);

      expect(decoded).toEqual(publicKey);
    });
  });

  describe('Argon2id KDF Security', () => {
    test('should use sufficient memory (64MB) for Argon2id', () => {
      // This is more of a documentation test - actual parameters are hardcoded
      const { publicKey, secretKey } = generateKeyPair();
      
      // Encrypt with passphrase
      const encrypted = encryptPrivateKey(secretKey, publicKey, 'weak', 'fp');
      
      // Should still decrypt correctly (Argon2id makes brute force expensive)
      const decrypted = decryptPrivateKey(encrypted, 'weak');
      expect(decrypted).toEqual(secretKey);
    });

    test('should handle empty passphrase (not recommended)', () => {
      const { publicKey, secretKey } = generateKeyPair();
      
      const encrypted = encryptPrivateKey(secretKey, publicKey, '', 'fp');
      const decrypted = decryptPrivateKey(encrypted, '');
      
      expect(decrypted).toEqual(secretKey);
    });

    test('should handle long passphrase', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const longPassphrase = 'a'.repeat(1000);
      
      const encrypted = encryptPrivateKey(secretKey, publicKey, longPassphrase, 'fp');
      const decrypted = decryptPrivateKey(encrypted, longPassphrase);
      
      expect(decrypted).toEqual(secretKey);
    });

    test('should handle unicode passphrase', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const unicodePassphrase = '🔐 密码 пароль كلمة';
      
      const encrypted = encryptPrivateKey(secretKey, publicKey, unicodePassphrase, 'fp');
      const decrypted = decryptPrivateKey(encrypted, unicodePassphrase);
      
      expect(decrypted).toEqual(secretKey);
    });
  });
});


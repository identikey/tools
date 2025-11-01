import { describe, test, expect } from 'bun:test';
import { armor, dearmor, isArmored, getArmorType } from './armor';
import { generateKeyPair } from '../../keypair';

describe('ASCII Armor', () => {
  describe('Public Key Armor', () => {
    test('should armor and dearmor public key roundtrip', () => {
      const { publicKey } = generateKeyPair();
      
      const armored = armor(publicKey, 'PUBLIC KEY', {
        Version: '1',
        KeyType: 'Ed25519',
        Fingerprint: 'abc123',
      });

      const result = dearmor(armored);

      expect(result.data).toEqual(publicKey);
      expect(result.type).toBe('PUBLIC KEY');
      expect(result.headers.Version).toBe('1');
      expect(result.headers.KeyType).toBe('Ed25519');
    });

    test('should include BEGIN/END delimiters', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      expect(armored).toContain('----- BEGIN IDENTIKEY PUBLIC KEY -----');
      expect(armored).toContain('----- END IDENTIKEY PUBLIC KEY -----');
    });

    test('should not wrap public key (single line)', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      // Extract payload between headers and checksum
      const lines = armored.split('\n');
      const payloadLines = lines.filter(
        (l) => !l.startsWith('-') && !l.includes(':') && !l.startsWith('=') && l.trim() !== ''
      );

      // Should be single line for keys
      expect(payloadLines.length).toBe(1);
    });

    test('should include CRC24 checksum', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      expect(armored).toMatch(/=.{4}/); // CRC24 Base64 is 4 chars
    });

    test('should preserve all headers', () => {
      const { publicKey } = generateKeyPair();
      const headers = {
        Version: '1',
        KeyType: 'Ed25519',
        Fingerprint: 'test-fp-123',
        Created: '2025-10-31T10:00:00Z',
        Comment: 'Test key',
      };

      const armored = armor(publicKey, 'PUBLIC KEY', headers);
      const result = dearmor(armored);

      expect(result.headers).toEqual(headers);
    });
  });

  describe('Private Key Armor', () => {
    test('should armor and dearmor private key roundtrip', () => {
      const { secretKey } = generateKeyPair();
      
      const armored = armor(secretKey, 'PRIVATE KEY', {
        Version: '1',
        KeyType: 'Ed25519',
        Fingerprint: 'abc123',
        Encrypted: 'XSalsa20-Poly1305',
      });

      const result = dearmor(armored);

      expect(result.data).toEqual(secretKey);
      expect(result.type).toBe('PRIVATE KEY');
    });

    test('should not wrap private key (single line)', () => {
      const { secretKey } = generateKeyPair();
      const armored = armor(secretKey, 'PRIVATE KEY', {
        Version: '1',
        Encrypted: 'XSalsa20-Poly1305',
      });

      const lines = armored.split('\n');
      const payloadLines = lines.filter(
        (l: string) => !l.startsWith('-') && !l.includes(':') && !l.startsWith('=') && l.trim() !== ''
      );

      expect(payloadLines.length).toBe(1);
    });

    test('should reject unencrypted private key without warning', () => {
      const { secretKey } = generateKeyPair();
      
      const armored = armor(secretKey, 'PRIVATE KEY', {
        Version: '1',
        Encrypted: 'false',
        // Missing Warning header
      });

      expect(() => {
        dearmor(armored);
      }).toThrow('Unencrypted key missing security warning');
    });

    test('should accept unencrypted private key with warning', () => {
      const { secretKey } = generateKeyPair();
      
      const armored = armor(secretKey, 'PRIVATE KEY', {
        Version: '1',
        Encrypted: 'false',
        Warning: 'UNENCRYPTED - INSECURE STORAGE',
      });

      const result = dearmor(armored);
      expect(result.data).toEqual(secretKey);
    });
  });

  describe('Encrypted Message Armor', () => {
    test('should armor and dearmor message roundtrip', () => {
      const plaintext = Buffer.from('Hello, IdentiKey!');
      
      const armored = armor(plaintext, 'ENCRYPTED MESSAGE', {
        Version: '1',
        RecipientFingerprint: 'test-fp',
        Nonce: 'test-nonce',
      });

      const result = dearmor(armored);

      expect(result.data).toEqual(plaintext);
      expect(result.type).toBe('ENCRYPTED MESSAGE');
    });

    test('should wrap message at 64 characters', () => {
      // Create message that will be >64 chars when Base64 encoded
      const longMessage = Buffer.alloc(200, 0xFF);
      
      const armored = armor(longMessage, 'ENCRYPTED MESSAGE', {
        Version: '1',
        RecipientFingerprint: 'test',
      });

      const lines = armored.split('\n');
      const payloadLines = lines.filter(
        (l) => !l.startsWith('-') && !l.includes(':') && !l.startsWith('=') && l.trim() !== ''
      );

      // Should have multiple lines
      expect(payloadLines.length).toBeGreaterThan(1);

      // Each line (except possibly last) should be <= 64 chars
      payloadLines.slice(0, -1).forEach((line: string) => {
        expect(line.length).toBeLessThanOrEqual(64);
      });
    });

    test('should handle empty message', () => {
      const empty = new Uint8Array(0);
      
      const armored = armor(empty, 'ENCRYPTED MESSAGE', { Version: '1' });
      const result = dearmor(armored);

      expect(result.data).toEqual(empty);
    });
  });

  describe('CRC24 Checksum', () => {
    test('should detect corrupted payload', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      // Corrupt payload by changing a character
      const corrupted = armored.replace(/([A-Za-z0-9]{10})/, (match: string) => 
        match[0] === 'A' ? 'B' + match.slice(1) : 'A' + match.slice(1)
      );

      expect(() => {
        dearmor(corrupted);
      }).toThrow('Checksum verification failed');
    });

    test('should detect missing checksum', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      // Remove checksum line
      const withoutChecksum = armored.split('\n').filter((l: string) => !l.startsWith('=')).join('\n');

      expect(() => {
        dearmor(withoutChecksum);
      }).toThrow('Missing CRC24 checksum');
    });

    test('should detect invalid checksum format', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      // Replace checksum with invalid format
      const invalidChecksum = armored.replace(/=.{4}/, '=XX');

      expect(() => {
        dearmor(invalidChecksum);
      }).toThrow();
    });
  });

  describe('Delimiter Validation', () => {
    test('should reject missing BEGIN delimiter', () => {
      const invalid = `
Version: 1
KeyType: Ed25519

5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
=2Zx
----- END IDENTIKEY PUBLIC KEY -----
`;

      expect(() => {
        dearmor(invalid);
      }).toThrow('missing BEGIN or END delimiter');
    });

    test('should reject missing END delimiter', () => {
      const invalid = `
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
KeyType: Ed25519

5J3mBbahZvksmjEjMmuZoDambXz7zvMi8mrBN5cV9MBL
=2Zx
`;

      expect(() => {
        dearmor(invalid);
      }).toThrow('missing BEGIN or END delimiter');
    });

    test('should reject BEGIN/END type mismatch', () => {
      const mismatch = `
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1

test
=AAAA
----- END IDENTIKEY PRIVATE KEY -----
`;

      expect(() => {
        dearmor(mismatch);
      }).toThrow('BEGIN/END type mismatch');
    });
  });

  describe('Header Parsing', () => {
    test('should parse headers with colons in value', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', {
        Version: '1',
        Comment: 'Test: with: multiple: colons',
      });

      const result = dearmor(armored);
      expect(result.headers.Comment).toBe('Test: with: multiple: colons');
    });

    test('should handle empty header value', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', {
        Version: '1',
        Comment: '',
      });

      const result = dearmor(armored);
      expect(result.headers.Comment).toBe('');
    });

    test('should reject invalid header format', () => {
      const invalid = `
----- BEGIN IDENTIKEY PUBLIC KEY -----
Version: 1
InvalidHeaderNoColon

test
=AAAA
----- END IDENTIKEY PUBLIC KEY -----
`;

      expect(() => {
        dearmor(invalid);
      }).toThrow('Invalid header format');
    });
  });

  describe('Auto-Detection', () => {
    test('should detect armored text', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      expect(isArmored(armored)).toBe(true);
    });

    test('should detect armored buffer', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });
      const buffer = Buffer.from(armored, 'utf-8');

      expect(isArmored(buffer)).toBe(true);
    });

    test('should not detect raw binary', () => {
      const { publicKey } = generateKeyPair();
      expect(isArmored(publicKey)).toBe(false);
    });

    test('should not detect random text', () => {
      const randomText = 'This is just random text without armor';
      expect(isArmored(randomText)).toBe(false);
    });

    test('should detect armor with leading whitespace', () => {
      const { publicKey } = generateKeyPair();
      const armored = '   \n\n' + armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      expect(isArmored(armored)).toBe(true);
    });
  });

  describe('getArmorType', () => {
    test('should extract PUBLIC KEY type', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });

      expect(getArmorType(armored)).toBe('PUBLIC KEY');
    });

    test('should extract PRIVATE KEY type', () => {
      const { secretKey } = generateKeyPair();
      const armored = armor(secretKey, 'PRIVATE KEY', { Version: '1', Encrypted: 'true' });

      expect(getArmorType(armored)).toBe('PRIVATE KEY');
    });

    test('should extract ENCRYPTED MESSAGE type', () => {
      const message = Buffer.from('test');
      const armored = armor(message, 'ENCRYPTED MESSAGE', { Version: '1' });

      expect(getArmorType(armored)).toBe('ENCRYPTED MESSAGE');
    });

    test('should return null for non-armored text', () => {
      expect(getArmorType('random text')).toBeNull();
    });
  });

  describe('Line Ending Tolerance', () => {
    test('should accept CRLF line endings', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });
      
      // Convert LF to CRLF
      const crlfArmored = armored.replace(/\n/g, '\r\n');

      const result = dearmor(crlfArmored);
      expect(result.data).toEqual(publicKey);
    });

    test('should accept mixed line endings', () => {
      const { publicKey } = generateKeyPair();
      const armored = armor(publicKey, 'PUBLIC KEY', { Version: '1' });
      
      // Mix CRLF and LF
      const mixed = armored.replace(/\n/g, (_match: string, offset: number) => 
        offset % 2 === 0 ? '\r\n' : '\n'
      );

      const result = dearmor(mixed);
      expect(result.data).toEqual(publicKey);
    });
  });

  describe('Base64 Payload Wrapping', () => {
    test('should unwrap whitespace in Base64 payload', () => {
      const message = Buffer.alloc(200, 0xAB);
      const armored = armor(message, 'ENCRYPTED MESSAGE', { Version: '1' });

      // Add extra whitespace
      const withWhitespace = armored.replace(/([A-Za-z0-9+/=]{20})/g, '$1   \t  ');

      const result = dearmor(withWhitespace);
      expect(result.data).toEqual(message);
    });
  });

  describe('Edge Cases', () => {
    test('should handle 32-byte key (typical Ed25519)', () => {
      const key = new Uint8Array(32).fill(0xAB);
      const armored = armor(key, 'PUBLIC KEY', { Version: '1' });
      const result = dearmor(armored);

      expect(result.data).toEqual(key);
    });

    test('should handle 64-byte secret key', () => {
      const secretKey = new Uint8Array(64).fill(0xCD);
      const armored = armor(secretKey, 'PRIVATE KEY', {
        Version: '1',
        Encrypted: 'true',
      });
      const result = dearmor(armored);

      expect(result.data).toEqual(secretKey);
    });

    test('should handle large message (1MB)', () => {
      const largeMessage = new Uint8Array(1024 * 1024).fill(0xEF);
      const armored = armor(largeMessage, 'ENCRYPTED MESSAGE', { Version: '1' });
      const result = dearmor(armored);

      expect(result.data).toEqual(largeMessage);
    });
  });
});


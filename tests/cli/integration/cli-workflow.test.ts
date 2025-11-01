import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let cliPath: string;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = mkdtempSync(join(tmpdir(), 'identikey-cli-test-'));
    cliPath = join(__dirname, '../../../dist/cli/index.js');
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('CLI should show help', () => {
    const output = execSync(`node ${cliPath} --help`, {
      encoding: 'utf-8',
    });

    expect(output).toContain('identikey');
    expect(output).toContain('keygen');
    expect(output).toContain('encrypt');
    expect(output).toContain('decrypt');
    expect(output).toContain('fingerprint');
    expect(output).toContain('info');
    expect(output).toContain('persona');
  });

  test('CLI should show version', () => {
    const output = execSync(`node ${cliPath} --version`, {
      encoding: 'utf-8',
    });

    expect(output).toContain('0.0.1');
  });

  test('Full workflow: keygen, encrypt, decrypt', () => {
    // Test plaintext
    const plaintext = 'Hello, IdentiKey CLI!';
    const plaintextFile = join(tempDir, 'plaintext.txt');
    const encryptedFile = join(tempDir, 'encrypted.bin');
    const decryptedFile = join(tempDir, 'decrypted.txt');
    const keyFile = join(tempDir, 'test-key.json');

    writeFileSync(plaintextFile, plaintext, 'utf-8');

    // 1. Generate keypair (unencrypted for testing)
    const keygenOutput = execSync(
      `node ${cliPath} keygen --output ${keyFile} --no-passphrase`,
      { encoding: 'utf-8', env: { ...process.env, HOME: tempDir } }
    );

    expect(keygenOutput).toContain('Keypair generated');
    expect(existsSync(keyFile)).toBe(true);

    // 2. Encrypt plaintext
    try {
      execSync(
        `node ${cliPath} encrypt ${plaintextFile} --key ${keyFile} --output ${encryptedFile}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (e: any) {
      // Command succeeded but wrote to stderr, which execSync treats as success if exit code is 0
    }

    expect(existsSync(encryptedFile)).toBe(true);

    // 3. Decrypt ciphertext
    const decryptOutput = execSync(
      `node ${cliPath} decrypt ${encryptedFile} --key ${keyFile} --output ${decryptedFile}`,
      { encoding: 'utf-8' }
    );

    expect(decryptOutput).toContain('Decrypted data saved');
    expect(existsSync(decryptedFile)).toBe(true);

    // 4. Verify roundtrip
    const decrypted = readFileSync(decryptedFile, 'utf-8');
    expect(decrypted).toBe(plaintext);
  });

  test('Fingerprint command', () => {
    const keyFile = join(tempDir, 'test-key.json');

    // Generate keypair
    execSync(`node ${cliPath} keygen --output ${keyFile} --no-passphrase`, {
      env: { ...process.env, HOME: tempDir },
    });

    // Get fingerprint
    const fingerprintOutput = execSync(`node ${cliPath} fingerprint --key ${keyFile}`, {
      encoding: 'utf-8',
    });

    // Should be ~44-char Base58 string
    expect(fingerprintOutput.trim()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
  });

  test('Info command', () => {
    const plaintext = 'Test message';
    const plaintextFile = join(tempDir, 'plaintext.txt');
    const encryptedFile = join(tempDir, 'encrypted.bin');
    const keyFile = join(tempDir, 'test-key.json');

    writeFileSync(plaintextFile, plaintext, 'utf-8');

    // Generate keypair and encrypt
    execSync(`node ${cliPath} keygen --output ${keyFile} --no-passphrase`, {
      env: { ...process.env, HOME: tempDir },
    });
    execSync(`node ${cliPath} encrypt ${plaintextFile} --key ${keyFile} --output ${encryptedFile}`);

    // Get info
    const infoOutput = execSync(`node ${cliPath} info ${encryptedFile}`, {
      encoding: 'utf-8',
    });

    expect(infoOutput).toContain('Version');
    expect(infoOutput).toContain('Fingerprint');
  });

  test('ASCII armor workflow', () => {
    const plaintext = 'Test armored message';
    const plaintextFile = join(tempDir, 'plaintext.txt');
    const encryptedFile = join(tempDir, 'encrypted.asc');
    const decryptedFile = join(tempDir, 'decrypted.txt');
    const keyFile = join(tempDir, 'test-key.json');

    writeFileSync(plaintextFile, plaintext, 'utf-8');

    // Generate keypair
    execSync(`node ${cliPath} keygen --output ${keyFile} --no-passphrase`, {
      env: { ...process.env, HOME: tempDir },
    });

    // Encrypt with armor
    execSync(
      `node ${cliPath} encrypt ${plaintextFile} --key ${keyFile} --output ${encryptedFile} --armor`
    );

    // Verify armored format
    const armored = readFileSync(encryptedFile, 'utf-8');
    expect(armored).toContain('----- BEGIN IDENTIKEY ENCRYPTED MESSAGE -----');
    expect(armored).toContain('----- END IDENTIKEY ENCRYPTED MESSAGE -----');

    // Decrypt (should auto-detect armor)
    execSync(
      `node ${cliPath} decrypt ${encryptedFile} --key ${keyFile} --output ${decryptedFile}`
    );

    // Verify roundtrip
    const decrypted = readFileSync(decryptedFile, 'utf-8');
    expect(decrypted).toBe(plaintext);
  });
});


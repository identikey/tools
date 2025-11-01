import { Command } from 'commander';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { readFileSync, statSync } from 'fs';
import { PersonaManager } from '../utils/persona-manager';
import { EncryptedStorage } from '../../api/encrypted-storage';
import { MemoryAdapter } from '../../storage/memory-adapter';
import { KeyManager } from '../../keypair';
import { isArmored, dearmor, armor } from '../utils/armor';
import { decodePublicKey } from '../utils/key-encryption';
import { readStdinOrFile, writeStdoutOrFile } from '../utils/file-io';

/**
 * Encrypt command: Encrypt data using a public key
 */
export function registerEncryptCommand(program: Command) {
  program
    .command('encrypt [input]')
    .description('Encrypt data using a public key')
    .option('--key <path>', 'Path to public key file (if not using persona)')
    .option('--output <file>', 'Output file (default: stdout)')
    .option('-a, --armor', 'Output ASCII-armored ciphertext')
    .action(async (input, options) => {
      let spinner: Ora | null = null;

      try {
        // Load public key
        let publicKey: Uint8Array;

        if (options.key) {
          // Load from file
          const keyData = readFileSync(options.key, 'utf-8');
          
          if (isArmored(keyData)) {
            const result = dearmor(keyData);
            publicKey = result.data;
          } else {
            try {
              const keyFile = JSON.parse(keyData);
              try {
                publicKey = decodePublicKey(keyFile.publicKey);
              } catch {
                publicKey = new Uint8Array(Buffer.from(keyFile.publicKey, 'base64'));
              }
            } catch {
              publicKey = new Uint8Array(Buffer.from(keyData, 'base64'));
            }
          }
        } else {
          // Load from active persona
          const manager = new PersonaManager();
          const activePersona = manager.getActivePersona();

          if (!activePersona) {
            console.error(chalk.red('Error: --key required or use active persona. Run \'identikey keygen\' first.'));
            process.exit(1);
          }

          const keyData = readFileSync(activePersona.keyPath, 'utf-8');
          const keyFile = JSON.parse(keyData);

          try {
            publicKey = decodePublicKey(keyFile.publicKey);
          } catch {
            publicKey = new Uint8Array(Buffer.from(keyFile.publicKey, 'base64'));
          }
        }

        // Read plaintext
        let fileSize = 0;
        let showProgress = false;

        if (input) {
          try {
            const stats = statSync(input);
            fileSize = stats.size;
            // Show progress for files > 10MB
            showProgress = fileSize > 10 * 1024 * 1024;
          } catch {
            // File doesn't exist or not accessible
          }
        }

        if (showProgress) {
          spinner = ora({
            text: `Encrypting ${(fileSize / (1024 * 1024)).toFixed(2)} MB...`,
            spinner: 'dots',
          }).start();
        }

        const plaintext = await readStdinOrFile(input);

        // Encrypt using EncryptedStorage
        const storage = new EncryptedStorage(new MemoryAdapter(), new KeyManager());
        const contentHash = await storage.put(plaintext, publicKey);

        // Retrieve encrypted blob
        const encryptedBlob = await storage.getMetadata(contentHash);
        
        // Get the full encrypted data (header + ciphertext)
        // We need to reconstruct the blob from storage
        const adapter = storage['storage']; // Access private storage adapter
        const storedBlob = await adapter.get(contentHash);

        if (!storedBlob) {
          throw new Error('Encryption failed: could not retrieve encrypted blob');
        }

        if (spinner) {
          spinner.succeed(chalk.green('Encryption complete'));
        }

        // Optionally armor the ciphertext
        let output: Buffer;
        if (options.armor) {
          const armored = armor(new Uint8Array(storedBlob), 'ENCRYPTED MESSAGE', {
            Version: '1',
            RecipientFingerprint: encryptedBlob.key_fingerprint,
            OriginalSize: plaintext.length.toString(),
            Created: encryptedBlob.created_at,
          });
          output = Buffer.from(armored, 'utf-8');
        } else {
          output = storedBlob;
        }

        // Write output
        writeStdoutOrFile(output, options.output);

        if (options.output) {
          console.error(chalk.green(`✓ Encrypted data saved to: ${options.output}`));
          console.error(chalk.gray(`  Content hash: ${contentHash.substring(0, 16)}...`));
        }

      } catch (error: any) {
        if (spinner) {
          spinner.fail(chalk.red('Encryption failed'));
        }
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
}


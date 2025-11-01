import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { PersonaManager } from '../utils/persona-manager';
import { EncryptedStorage } from '../../api/encrypted-storage';
import { MemoryAdapter } from '../../storage/memory-adapter';
import { KeyManager } from '../../keypair';
import { isArmored, dearmor } from '../utils/armor';
import { decryptPrivateKey } from '../utils/key-encryption';
import { readStdinOrFile, writeStdoutOrFile } from '../utils/file-io';
import * as readline from 'readline';

/**
 * Prompt user for passphrase securely (hidden input)
 */
async function promptPassphrase(prompt: string = 'Enter passphrase: '): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const mutableStdout = process.stdout as any;
    const originalWrite = mutableStdout.write;
    
    mutableStdout.write = (chunk: any, encoding?: any, callback?: any) => {
      if (chunk.toString().includes(prompt)) {
        return originalWrite.call(mutableStdout, chunk, encoding, callback);
      }
      if (callback) callback();
      return true;
    };

    rl.question(prompt, (answer) => {
      mutableStdout.write = originalWrite;
      console.log();
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Decrypt command: Decrypt data using a private key
 */
export function registerDecryptCommand(program: Command) {
  program
    .command('decrypt [input]')
    .description('Decrypt data using a private key')
    .option('--key <path>', 'Path to private key file (if not using persona)')
    .option('--output <file>', 'Output file (default: stdout)')
    .action(async (input, options) => {
      try {
        // Read ciphertext
        const ciphertextRaw = await readStdinOrFile(input);

        // Auto-detect armor and dearmor if needed
        let ciphertext: Buffer;
        if (isArmored(ciphertextRaw)) {
          const result = dearmor(ciphertextRaw.toString('utf-8'));
          ciphertext = Buffer.from(result.data);
        } else {
          ciphertext = ciphertextRaw;
        }

        // Load private key
        let privateKey: Uint8Array;

        if (options.key) {
          // Load from file
          const keyData = readFileSync(options.key, 'utf-8');
          
          if (isArmored(keyData)) {
            const result = dearmor(keyData);
            privateKey = result.data;
          } else {
            const keyFile = JSON.parse(keyData);
            
            // Check if key is encrypted
            if (keyFile.salt && keyFile.nonce) {
              // Encrypted key, prompt for passphrase
              const passphrase = await promptPassphrase('Enter passphrase to decrypt key: ');
              privateKey = decryptPrivateKey(keyFile, passphrase);
            } else {
              // Unencrypted key
              privateKey = new Uint8Array(Buffer.from(keyFile.privateKey, 'base64'));
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

          // Check if key is encrypted
          if (keyFile.salt && keyFile.nonce) {
            // Encrypted key, prompt for passphrase
            const passphrase = await promptPassphrase('Enter passphrase to decrypt key: ');
            try {
              privateKey = decryptPrivateKey(keyFile, passphrase);
            } catch (err: any) {
              console.error(chalk.red('Error: Wrong passphrase or corrupted key file.'));
              process.exit(1);
            }
          } else {
            // Unencrypted key
            privateKey = new Uint8Array(Buffer.from(keyFile.privateKey, 'base64'));
          }
        }

        // Decrypt using EncryptedStorage
        const storage = new EncryptedStorage(new MemoryAdapter(), new KeyManager());
        
        // Store the encrypted blob temporarily to decrypt it
        const adapter = storage['storage'];
        const tempHash = 'temp-' + Date.now();
        await adapter.put(tempHash, ciphertext, {});

        // Decrypt
        const plaintext = await storage.get(tempHash, privateKey);

        // Write output
        writeStdoutOrFile(plaintext, options.output);

        if (options.output) {
          console.error(chalk.green(`✓ Decrypted data saved to: ${options.output}`));
        }

      } catch (error: any) {
        console.error(chalk.red('Error: Decryption failed. Wrong key or corrupted ciphertext.'));
        if (error.message) {
          console.error(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}


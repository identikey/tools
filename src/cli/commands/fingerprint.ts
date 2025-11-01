import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { PersonaManager } from '../utils/persona-manager';
import { computeFingerprint } from '../../header/fingerprint';
import { isArmored, dearmor } from '../utils/armor';
import { decodePublicKey } from '../utils/key-encryption';

/**
 * Fingerprint command: Display fingerprint of a public key
 */
export function registerFingerprintCommand(program: Command) {
  program
    .command('fingerprint')
    .description('Display fingerprint of a public key')
    .option('--key <path>', 'Path to public key file (if not using persona)')
    .option('--json', 'Output as JSON')
    .action((options) => {
      try {
        let publicKey: Uint8Array;

        // Load public key from file or persona
        if (options.key) {
          // Load from file
          const keyData = readFileSync(options.key, 'utf-8');
          
          if (isArmored(keyData)) {
            // Dearmor if needed
            const result = dearmor(keyData);
            publicKey = result.data;
          } else {
            // Try parsing as JSON (EncryptedKeyFile format)
            try {
              const keyFile = JSON.parse(keyData);
              
              if (keyFile.publicKey) {
                // Decode Base58 or Base64 public key
                try {
                  publicKey = decodePublicKey(keyFile.publicKey);
                } catch {
                  // If Base58 fails, try Base64
                  publicKey = new Uint8Array(Buffer.from(keyFile.publicKey, 'base64'));
                }
              } else {
                throw new Error('Invalid key file format: missing publicKey field');
              }
            } catch (err) {
              // Try as raw binary
              publicKey = new Uint8Array(Buffer.from(keyData, 'base64'));
            }
          }
        } else {
          // Load from active persona
          const manager = new PersonaManager();
          const activePersona = manager.getActivePersona();

          if (!activePersona) {
            console.error(chalk.red('Error: No active persona and no --key provided.'));
            console.error(chalk.gray('Run "identikey keygen" first or use --key <path>.'));
            process.exit(1);
          }

          // Load key from persona
          const keyData = readFileSync(activePersona.keyPath, 'utf-8');
          const keyFile = JSON.parse(keyData);

          // Decode public key
          try {
            publicKey = decodePublicKey(keyFile.publicKey);
          } catch {
            publicKey = new Uint8Array(Buffer.from(keyFile.publicKey, 'base64'));
          }
        }

        // Compute fingerprint
        const fingerprint = computeFingerprint(publicKey);

        // Output as JSON or text
        if (options.json) {
          console.log(JSON.stringify({
            fingerprint,
            keyType: 'Ed25519',
          }, null, 2));
        } else {
          console.log(fingerprint);
        }

      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
}


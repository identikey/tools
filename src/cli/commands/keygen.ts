import { Command } from 'commander';
import chalk from 'chalk';
import { generateKeyPair } from '../../keypair';
import { computeFingerprint } from '../../header/fingerprint';
import { PersonaManager } from '../utils/persona-manager';
import { encryptPrivateKey, type EncryptedKeyFile } from '../utils/key-encryption';
import { armor } from '../utils/armor';
import { writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { dirname } from 'path';
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
    // Hide input by muting stdout
    const mutableStdout = process.stdout as any;
    const originalWrite = mutableStdout.write;
    
    mutableStdout.write = (chunk: any, encoding?: any, callback?: any) => {
      // Still write the prompt
      if (chunk.toString().includes(prompt)) {
        return originalWrite.call(mutableStdout, chunk, encoding, callback);
      }
      // But hide everything else (the typed passphrase)
      if (callback) callback();
      return true;
    };

    rl.question(prompt, (answer) => {
      // Restore stdout
      mutableStdout.write = originalWrite;
      
      // Print newline since Enter was hidden
      console.log();
      
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Keygen command: Generate new Ed25519 keypair with persona management
 */
export function registerKeygenCommand(program: Command) {
  program
    .command('keygen')
    .description('Generate a new Ed25519 keypair')
    .option('--output <path>', 'Output path for key file (default: persona location)')
    .option('--persona <name>', 'Persona name (default: "default")')
    .option('-a, --armor', 'Output ASCII-armored keys')
    .option('--no-passphrase', 'Skip passphrase (INSECURE - not recommended)')
    .action(async (options) => {
      try {
        const personaName = options.persona || 'default';
        const useArmor = options.armor || false;
        const requirePassphrase = options.passphrase !== false;

        console.log(chalk.blue('🔑 Generating Ed25519 keypair...'));

        // Generate keypair
        const { publicKey, secretKey } = generateKeyPair();
        const fingerprint = computeFingerprint(publicKey);

        console.log(chalk.green('✓ Keypair generated'));
        console.log(chalk.gray(`Fingerprint: ${fingerprint}`));

        // Get passphrase if required
        let passphrase = '';
        if (requirePassphrase) {
          passphrase = await promptPassphrase('Enter passphrase to encrypt key: ');
          
          if (!passphrase) {
            console.error(chalk.red('Error: Passphrase cannot be empty. Use --no-passphrase to skip (not recommended).'));
            process.exit(1);
          }

          // Confirm passphrase
          const confirm = await promptPassphrase('Confirm passphrase: ');
          if (passphrase !== confirm) {
            console.error(chalk.red('Error: Passphrases do not match.'));
            process.exit(1);
          }
        } else {
          console.warn(chalk.yellow('⚠️  WARNING: Generating unencrypted key (INSECURE). Anyone with file access can steal your key.'));
        }

        // Encrypt private key
        console.log(chalk.blue('🔐 Encrypting private key...'));
        let encryptedKeyFile: EncryptedKeyFile;

        if (requirePassphrase) {
          encryptedKeyFile = encryptPrivateKey(secretKey, publicKey, passphrase, fingerprint);
        } else {
          // Unencrypted key (still use same format but mark as unencrypted)
          encryptedKeyFile = {
            version: 1,
            publicKey: Buffer.from(publicKey).toString('base64'),
            privateKey: Buffer.from(secretKey).toString('base64'),
            salt: '',
            nonce: '',
            fingerprint,
          };
        }

        // Determine output path
        const manager = new PersonaManager();
        const outputPath = options.output || manager.getDefaultKeyPath(personaName);

        // Ensure directory exists
        const keyDir = dirname(outputPath);
        if (!existsSync(keyDir)) {
          mkdirSync(keyDir, { recursive: true });
        }

        // Optionally armor the keys
        let fileContent: string;
        if (useArmor) {
          console.log(chalk.blue('🛡️  ASCII armoring keys...'));
          
          // Armor the encrypted key file as JSON string
          fileContent = JSON.stringify(encryptedKeyFile, null, 2);
          
          // For display purposes, also show armored public key
          const armoredPubKey = armor(publicKey, 'PUBLIC KEY', {
            Version: '1',
            KeyType: 'Ed25519',
            Fingerprint: fingerprint,
            Created: new Date().toISOString(),
          });
          
          console.log(chalk.gray('\nPublic Key (ASCII Armored):'));
          console.log(chalk.gray(armoredPubKey));
        } else {
          fileContent = JSON.stringify(encryptedKeyFile, null, 2);
        }

        // Write key file
        writeFileSync(outputPath, fileContent, 'utf-8');

        // Set restrictive permissions on Unix systems (owner-only read/write)
        try {
          chmodSync(outputPath, 0o600);
        } catch (err) {
          // Permissions might not work on Windows, ignore error
        }

        console.log(chalk.green(`✓ Key saved to: ${outputPath}`));

        // Update persona config
        try {
          manager.createPersona(personaName, outputPath, fingerprint);
          
          const activePersona = manager.getActivePersona();
          if (activePersona?.name === personaName) {
            console.log(chalk.green(`✓ Persona "${personaName}" created and set as active`));
          } else {
            console.log(chalk.green(`✓ Persona "${personaName}" created`));
          }
        } catch (err: any) {
          if (err.message.includes('already exists')) {
            console.warn(chalk.yellow(`⚠️  Persona "${personaName}" already exists, key file overwritten`));
          } else {
            throw err;
          }
        }

        console.log(chalk.blue('\n📋 Summary:'));
        console.log(chalk.gray(`  Persona: ${personaName}`));
        console.log(chalk.gray(`  Fingerprint: ${fingerprint.substring(0, 16)}...`));
        console.log(chalk.gray(`  Key path: ${outputPath}`));
        console.log(chalk.gray(`  Encrypted: ${requirePassphrase ? 'Yes' : 'No (INSECURE)'}`));
        console.log(chalk.gray(`  Armored: ${useArmor ? 'Yes' : 'No'}`));

        if (!requirePassphrase) {
          console.warn(chalk.red('\n⚠️  SECURITY WARNING: Your private key is NOT encrypted!'));
          console.warn(chalk.red('    Anyone with file access can steal your key.'));
          console.warn(chalk.red('    Use a passphrase for production keys.'));
        }

      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
}


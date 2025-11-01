import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { readFileSync } from 'fs';
import { parseHeader } from '../../header/parse';
import { isArmored, dearmor } from '../utils/armor';

/**
 * Info command: Display metadata of an encrypted blob
 */
export function registerInfoCommand(program: Command) {
  program
    .command('info <blob>')
    .description('Display metadata of an encrypted blob')
    .option('--json', 'Output as JSON')
    .action((blobPath, options) => {
      try {
        // Read encrypted blob
        let blob = readFileSync(blobPath);

        // Check if armored, dearmor if needed
        if (isArmored(blob)) {
          const result = dearmor(blob.toString('utf-8'));
          blob = Buffer.from(result.data);
        }

        // Parse header
        const { header, ciphertextOffset } = parseHeader(blob);

        // Extract metadata
        const metadata = {
          version: header.version,
          key_fingerprint: header.key_fingerprint,
          created_at: header.metadata?.created_at || 'N/A',
          content_hash: header.metadata?.content_hash || 'N/A',
          ciphertext_size: blob.length - ciphertextOffset,
          total_size: blob.length,
        };

        // Output as JSON or table
        if (options.json) {
          console.log(JSON.stringify(metadata, null, 2));
        } else {
          const table = new Table({
            head: [chalk.cyan('Property'), chalk.cyan('Value')],
            colWidths: [25, 55],
          });

          table.push(
            ['Version', metadata.version.toString()],
            ['Key Fingerprint', metadata.key_fingerprint.substring(0, 16) + '...'],
            ['Created At', metadata.created_at],
            ['Content Hash', typeof metadata.content_hash === 'string' 
              ? metadata.content_hash.substring(0, 16) + '...' 
              : 'N/A'],
            ['Ciphertext Size', `${metadata.ciphertext_size} bytes`],
            ['Total Size', `${metadata.total_size} bytes`],
          );

          console.log(table.toString());
        }

      } catch (error: any) {
        console.error(chalk.red('Error: Failed to parse blob metadata.'));
        if (error.message) {
          console.error(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}


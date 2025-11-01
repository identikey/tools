import { readFileSync, writeFileSync } from 'fs';
import { stdin, stdout } from 'process';

/**
 * Read data from stdin or file
 */
export async function readStdinOrFile(filePath?: string): Promise<Buffer> {
  if (filePath) {
    // Read from file
    return readFileSync(filePath);
  }

  // Check if stdin is a TTY (interactive terminal)
  if (stdin.isTTY) {
    throw new Error('No input provided. Pipe data via stdin or specify a file.');
  }

  // Read from stdin
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stdin.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    stdin.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stdin.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Write data to stdout or file
 */
export function writeStdoutOrFile(data: Buffer, filePath?: string): void {
  if (filePath) {
    // Write to file
    writeFileSync(filePath, data);
  } else {
    // Write to stdout
    stdout.write(data);
  }
}

/**
 * Check if stdin is available (not a TTY)
 */
export function isStdinAvailable(): boolean {
  return !stdin.isTTY;
}

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isStdoutTTY(): boolean {
  return stdout.isTTY;
}


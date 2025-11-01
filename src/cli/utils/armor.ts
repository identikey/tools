import bs58 from 'bs58';

/**
 * Armor types supported
 */
export type ArmorType = 'PUBLIC KEY' | 'PRIVATE KEY' | 'ENCRYPTED MESSAGE';

/**
 * Armor result with decoded data and headers
 */
export interface ArmorResult {
  data: Uint8Array;
  type: ArmorType;
  headers: Record<string, string>;
}

/**
 * CRC24 parameters (OpenPGP standard)
 */
const CRC24_INIT = 0xb704ce;
const CRC24_POLY = 0x1864cfb;

/**
 * Compute CRC24 checksum for data
 */
function crc24(data: Uint8Array): number {
  let crc = CRC24_INIT;
  
  for (const byte of data) {
    crc ^= byte << 16;
    for (let i = 0; i < 8; i++) {
      crc <<= 1;
      if (crc & 0x1000000) {
        crc ^= CRC24_POLY;
      }
    }
  }
  
  return crc & 0xffffff;
}

/**
 * Encode CRC24 checksum to Base64 string
 */
function encodeCrc24(crc: number): string {
  const bytes = new Uint8Array([
    (crc >> 16) & 0xff,
    (crc >> 8) & 0xff,
    crc & 0xff,
  ]);
  return Buffer.from(bytes).toString('base64');
}

/**
 * Decode CRC24 checksum from Base64 string
 */
function decodeCrc24(base64: string): number {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length !== 3) {
    throw new Error(`Invalid CRC24 length: expected 3 bytes, got ${bytes.length}`);
  }
  return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
}

/**
 * Wrap Base64 string at 64 characters per line
 */
function wrapBase64(base64: string, lineLength: number = 64): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += lineLength) {
    lines.push(base64.substring(i, i + lineLength));
  }
  return lines.join('\n');
}

/**
 * Unwrap Base64 string (remove all whitespace)
 * (Currently unused but kept for potential future use)
 */
// function unwrapBase64(wrapped: string): string {
//   return wrapped.replace(/\s+/g, '');
// }

/**
 * ASCII armor binary data with specified type and headers
 */
export function armor(
  data: Uint8Array,
  type: ArmorType,
  headers: Record<string, string> = {}
): string {
  // Compute CRC24 checksum
  const checksum = crc24(data);
  const crcString = encodeCrc24(checksum);

  // Encode payload based on type
  let payload: string;
  if (type === 'PUBLIC KEY' || type === 'PRIVATE KEY') {
    // Keys use Base58, no wrapping
    payload = bs58.encode(data);
  } else {
    // Messages use Base64, 64-char wrapping
    const base64 = Buffer.from(data).toString('base64');
    payload = wrapBase64(base64);
  }

  // Build header lines
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}: ${value ?? ''}`);

  // Assemble armored block
  const lines = [
    `----- BEGIN IDENTIKEY ${type} -----`,
    ...headerLines,
    '', // Blank line after headers
    payload,
    `=${crcString}`,
    `----- END IDENTIKEY ${type} -----`,
  ];

  return lines.join('\n');
}

/**
 * Dearmor ASCII-armored text back to binary data
 */
export function dearmor(armoredText: string): ArmorResult {
  const lines = armoredText.split(/\r?\n/);

  // Find BEGIN and END delimiters
  const beginIdx = lines.findIndex((l) => l.trim().startsWith('----- BEGIN IDENTIKEY '));
  const endIdx = lines.findIndex((l) => l.trim().startsWith('----- END IDENTIKEY '));

  if (beginIdx === -1 || endIdx === -1) {
    throw new Error('Invalid armor format: missing BEGIN or END delimiter');
  }

  // Extract type from BEGIN line
  const beginMatch = lines[beginIdx].match(/----- BEGIN IDENTIKEY (.*?) -----/);
  const endMatch = lines[endIdx].match(/----- END IDENTIKEY (.*?) -----/);

  if (!beginMatch || !endMatch) {
    throw new Error('Invalid armor format: malformed delimiter');
  }

  const beginType = beginMatch?.[1];
  const endType = endMatch?.[1];

  if (!beginType || !endType) {
    throw new Error('Invalid armor format: could not extract type');
  }

  if (beginType !== endType) {
    throw new Error(`BEGIN/END type mismatch: ${beginType} vs ${endType}`);
  }

  const type = beginType as ArmorType;

  // Parse headers (lines between BEGIN and first blank line)
  const headers: Record<string, string> = {};
  let payloadStartIdx = beginIdx + 1;

  for (let i = beginIdx + 1; i < endIdx; i++) {
    const line = lines[i].trim();
    if (line === '') {
      payloadStartIdx = i + 1;
      break;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(`Invalid header format: ${line}`);
    }

    const key = line.substring(0, colonIdx);
    // Skip colon and optional space
    const valueStart = line[colonIdx + 1] === ' ' ? colonIdx + 2 : colonIdx + 1;
    const value = line.substring(valueStart) ?? '';
    headers[key] = value;
  }

  // Extract payload and checksum
  const payloadLines: string[] = [];
  let checksumLine: string | null = null;

  for (let i = payloadStartIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (line.startsWith('=')) {
      checksumLine = line.substring(1); // Remove '=' prefix
    } else if (line) {
      payloadLines.push(line);
    }
  }

  if (!checksumLine) {
    throw new Error('Missing CRC24 checksum');
  }

  // Decode payload based on type
  let data: Uint8Array;
  const payload = payloadLines.join('');

  try {
    if (type === 'PUBLIC KEY' || type === 'PRIVATE KEY') {
      // Keys use Base58
      data = bs58.decode(payload);
    } else {
      // Messages use Base64
      data = new Uint8Array(Buffer.from(payload, 'base64'));
    }
  } catch (error) {
    throw new Error(`Failed to decode payload: ${error}`);
  }

  // Verify checksum
  const expectedCrc = decodeCrc24(checksumLine);
  const actualCrc = crc24(data);

  if (actualCrc !== expectedCrc) {
    throw new Error(`Checksum verification failed: expected ${expectedCrc.toString(16)}, got ${actualCrc.toString(16)}`);
  }

  // Validate unencrypted private key warning
  if (type === 'PRIVATE KEY' && headers.Encrypted === 'false') {
    if (!headers.Warning?.match(/UNENCRYPTED|INSECURE/i)) {
      throw new Error('Unencrypted key missing security warning');
    }
  }

  return { data, type, headers };
}

/**
 * Check if input is ASCII armored
 */
export function isArmored(input: Buffer | string): boolean {
  const text = typeof input === 'string' ? input : input.toString('utf-8');
  return /^----- BEGIN IDENTIKEY /.test(text.trimStart());
}

/**
 * Extract armor type from armored text
 */
export function getArmorType(armored: string): ArmorType | null {
  const match = armored.match(/----- BEGIN IDENTIKEY (.*?) -----/);
  return match ? (match[1] as ArmorType) : null;
}


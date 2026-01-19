import crypto from 'crypto';

/**
 * Cross-environment UUID v4 generator.
 * Uses crypto.randomUUID() when available, otherwise falls back to a
 * secure random-bytes based v4 implementation.
 */
export function uuidv4(): string {
  if (typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }

  // Fallback: RFC4122 version 4 implementation using random bytes
  const bytes = crypto.randomBytes(16);
  // Per RFC 4122 4.4, set bits for version and `clock_seq_hi_and_reserved`
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return (
    hex.substr(0, 8) + '-' +
    hex.substr(8, 4) + '-' +
    hex.substr(12, 4) + '-' +
    hex.substr(16, 4) + '-' +
    hex.substr(20, 12)
  );
}

export default uuidv4;

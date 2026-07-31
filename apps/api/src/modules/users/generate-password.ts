import { randomInt } from 'crypto';

// Excludes visually-ambiguous characters (0/O, 1/l/I) — this is read off a screen and typed or
// copy-pasted by an admin relaying it to a new teammate, not entered programmatically.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
const PASSWORD_LENGTH = 16;

/** A cryptographically random password for a newly created or reset user account. Plaintext
 * exists only transiently — the caller returns it once in the HTTP response and never persists
 * it; BetterAuth hashes it before storage. */
export function generatePassword(): string {
  let password = '';
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    password += CHARSET[randomInt(CHARSET.length)];
  }
  return password;
}

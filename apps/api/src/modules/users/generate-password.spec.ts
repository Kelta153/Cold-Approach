import { describe, expect, it } from 'vitest';
import { generatePassword } from './generate-password';

const AMBIGUOUS_CHARS = ['0', 'O', '1', 'l', 'I'];

describe('generatePassword', () => {
  it('generates a 16-character password', () => {
    expect(generatePassword()).toHaveLength(16);
  });

  it('never includes visually-ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      for (const ambiguous of AMBIGUOUS_CHARS) {
        expect(password).not.toContain(ambiguous);
      }
    }
  });

  it('generates a different password on every call', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(passwords.size).toBe(20);
  });
});

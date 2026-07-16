import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `sending.service.ts`'s `attemptSend` must be the *only* place in `apps/api` that writes a
 * `Send` row. This walks the entire `src` tree and asserts `prisma.send.create` appears in
 * exactly one file: this module's own service. If a future change adds a second call site
 * (e.g. a shortcut in the replies or notifications module), this test fails loudly.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('Send table write path', () => {
  it('is written to from exactly one file: modules/sending/sending.service.ts', () => {
    const srcRoot = join(__dirname, '..', '..');
    const files = walk(srcRoot);

    const writers = files.filter((file) => {
      const contents = readFileSync(file, 'utf8');
      return /prisma\.send\.create\s*\(/.test(contents) || /\.db\.send\.create\s*\(/.test(contents);
    });

    expect(writers).toHaveLength(1);
    expect(writers[0].replace(/\\/g, '/')).toMatch(/modules\/sending\/sending\.service\.ts$/);
  });
});

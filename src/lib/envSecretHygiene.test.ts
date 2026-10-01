import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PROJECT_ROOT = join(SRC_ROOT, '..');

// Any VITE_-prefixed name containing these words would be bundled to the browser.
const FORBIDDEN = /VITE_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|AUTH_TOKEN|AUTH_KEY)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('client env secret hygiene', () => {
  it('no source file references a VITE_-prefixed secret variable', () => {
    const self = fileURLToPath(import.meta.url);
    const offenders = walk(SRC_ROOT)
      .filter((f) => f !== self)
      .filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('.env.example does not define a VITE_-prefixed secret', () => {
    const example = readFileSync(join(PROJECT_ROOT, '.env.example'), 'utf8');
    expect(example).not.toMatch(FORBIDDEN);
  });

  it('Razorpay key secret is read only by Edge Functions under its non-public name', () => {
    for (const fn of ['create-host-subscription-order', 'verify-host-subscription']) {
      const src = readFileSync(
        join(PROJECT_ROOT, 'supabase/functions', fn, 'index.ts'),
        'utf8',
      );
      expect(src).toMatch(/Deno\.env\.get\('RAZORPAY_KEY_SECRET'\)/);
    }
  });
});

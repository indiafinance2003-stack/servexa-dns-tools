import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

function readSource(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

describe('password-reset logging hygiene (static source audit)', () => {
  it('never logs raw tokens, reset URLs, passwords, or provider credentials', () => {
    const resetFiles = [
      readSource('src', 'lib', 'auth', 'password-reset.ts'),
      readSource('src', 'lib', 'email', 'transactional', 'index.ts'),
      readSource('src', 'lib', 'email', 'transactional', 'provider.ts'),
      readSource('src', 'lib', 'email', 'transactional', 'templates.ts'),
      readSource('src', 'app', 'api', 'auth', 'forgot-password', 'route.ts'),
      readSource('src', 'app', 'api', 'auth', 'reset-password', 'route.ts'),
    ];
    for (const source of resetFiles) {
      // Token/secret-shaped identifiers must never reach a logging call in
      // these files: the raw token variable is named `token`/`resetUrl`, and
      // neither may appear inside a logger/console/data payload expression.
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        const touchesLog =
          line.includes('logger.') ||
          line.includes('console.') ||
          line.includes('reason:') ||
          line.includes('data:');
        if (!touchesLog) return;
        const lower = line.toLowerCase();
        expect(
          lower.includes('reseturl') ||
            (lower.includes('token') && !lower.includes('tokenhash') && !lower.includes('token hash')) ||
            lower.includes('password:') ||
            lower.includes('api_key') ||
            lower.includes('apikey') ||
            lower.includes('smtp') ||
            lower.includes('credential'),
          `potential secret logging at line ${index + 1}: ${line.trim()}`
        ).toBe(false);
      });
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)\s*\(/);
    }
  });

  it('reset-password client components never log or persist the token', async () => {
    const page = readSource('src', 'app', 'reset-password', 'page.tsx');
    const form = readSource('src', 'components', 'auth', 'reset-password-form.tsx');
    const forgot = readSource('src', 'components', 'auth', 'forgot-password-form.tsx');
    for (const source of [page, form, forgot]) {
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)\s*\(/);
      // No Web Storage API usage on the reset path.
      expect(source).not.toMatch(/localStorage/);
      expect(source).not.toMatch(/sessionStorage/);
    }
    // Dynamic guard: the mocks only assert the rule; the static scan above is
    // the enforcement. This test exists to keep the rule visible in reports.
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});

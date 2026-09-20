import { describe, expect, it } from 'vitest';
import { parseLicenseKey } from '@/lib/control/licensing';

describe('license key parsing', () => {
  it('parses a well-formed key', () => {
    const result = parseLicenseKey('RVLY-LIC-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('RVLY-LIC');
    expect(result!.secret).toBe('abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('parses a key with multiple prefix segments', () => {
    const result = parseLicenseKey('RVLY-LIC-V2-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('RVLY-LIC-V2');
    expect(result!.secret).toBe('abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('rejects keys with too-short secrets (< 32 chars)', () => {
    expect(parseLicenseKey('RVLY-LIC-short')).toBeNull();
  });

  it('rejects keys with no separator', () => {
    expect(parseLicenseKey('RVLYLIC123456789012345678901234567890ABcd')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(parseLicenseKey('')).toBeNull();
  });

  it('rejects whitespace-only input', () => {
    expect(parseLicenseKey('   ')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    const result = parseLicenseKey('  RVLY-LIC-abcdefghijklmnopqrstuvwxyz0123456789  ');
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('RVLY-LIC');
  });
});


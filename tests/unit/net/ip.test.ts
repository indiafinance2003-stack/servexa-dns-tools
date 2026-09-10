import { describe, it, expect } from 'vitest';
import { classifyIP, parseIP } from '@/lib/net/ip';

describe('IP classification', () => {
  it('parses IPv4 and IPv6', () => {
    expect(parseIP('192.0.2.1')?.version).toBe(4);
    expect(parseIP('2001:db8::1')?.version).toBe(6);
  });

  it('classifies loopback private link-local and public', () => {
    expect(classifyIP(parseIP('127.0.0.1')!)).toBe('loopback');
    expect(classifyIP(parseIP('10.0.0.1')!)).toBe('private');
    expect(classifyIP(parseIP('192.168.1.1')!)).toBe('private');
    expect(classifyIP(parseIP('169.254.1.1')!)).toBe('link-local');
    expect(classifyIP(parseIP('8.8.8.8')!)).toBe('public');
    expect(classifyIP(parseIP('::1')!)).toBe('loopback');
  });

  it('rejects malformed IPv4', () => {
    expect(parseIP('10.0.0.1.hack.com')).toBeNull();
    expect(parseIP('256.1.1.1')).toBeNull();
    expect(parseIP('01.2.3.4')).toBeNull();
  });
});

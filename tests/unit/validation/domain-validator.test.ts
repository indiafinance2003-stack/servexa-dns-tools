import { describe, it, expect } from 'vitest';
import { validateDomain, validatePublicIP, validateSelector } from '@/lib/validation/domain-validator';
import { InvalidDomainError, ValidationError } from '@/lib/errors/app-error';

describe('Domain Validator', () => {
  it('validates and lowercases a domain', () => {
    expect(validateDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('strips a trailing dot', () => {
    expect(validateDomain('example.com.')).toBe('example.com');
  });

  it('allows service labels used by SRV/DKIM', () => {
    expect(validateDomain('_dmarc.example.com')).toBe('_dmarc.example.com');
  });

  it('rejects empty input', () => {
    expect(() => validateDomain('')).toThrow(InvalidDomainError);
  });

  it('rejects localhost and .local', () => {
    expect(() => validateDomain('localhost')).toThrow(InvalidDomainError);
    expect(() => validateDomain('printer.local')).toThrow(InvalidDomainError);
  });

  it('rejects IP addresses as domains', () => {
    expect(() => validateDomain('127.0.0.1')).toThrow(InvalidDomainError);
    expect(() => validateDomain('8.8.8.8')).toThrow(InvalidDomainError);
  });

  it('rejects private and link-local looking hostnames that are IPs', () => {
    expect(() => validateDomain('10.0.0.1')).toThrow(InvalidDomainError);
    expect(() => validateDomain('169.254.1.1')).toThrow(InvalidDomainError);
  });

  it('rejects single labels and oversize names', () => {
    expect(() => validateDomain('com')).toThrow(InvalidDomainError);
    expect(() => validateDomain(`${'a'.repeat(64)}.com`)).toThrow(InvalidDomainError);
    expect(() => validateDomain(`${'a'.repeat(254)}.com`)).toThrow(InvalidDomainError);
  });

  it('rejects invalid characters and hyphen edges', () => {
    expect(() => validateDomain('exam@ple.com')).toThrow(InvalidDomainError);
    expect(() => validateDomain('-example.com')).toThrow(InvalidDomainError);
  });

  it('rejects control characters', () => {
    expect(() => validateDomain('example.com\n')).toThrow(InvalidDomainError);
  });

  it('validates DKIM selectors', () => {
    expect(validateSelector('google')).toBe('google');
    expect(() => validateSelector('bad selector')).toThrow(ValidationError);
  });

  it('validates public IPs and rejects probing targets', () => {
    expect(validatePublicIP('8.8.8.8').canonical).toBe('8.8.8.8');
    expect(() => validatePublicIP('127.0.0.1')).toThrow(ValidationError);
    expect(() => validatePublicIP('10.1.1.1')).toThrow(ValidationError);
    expect(() => validatePublicIP('169.254.1.1')).toThrow(ValidationError);
    expect(() => validatePublicIP('::1')).toThrow(ValidationError);
    expect(() => validatePublicIP('not-an-ip')).toThrow(ValidationError);
  });
});

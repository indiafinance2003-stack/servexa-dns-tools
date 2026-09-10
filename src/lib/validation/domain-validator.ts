import { InvalidDomainError, ValidationError } from '@/lib/errors/app-error';
import { classifyIP, parseIP } from '@/lib/net/ip';

const LOCALHOST_NAMES = new Set(['localhost', 'localhost.localdomain']);
const BLOCKED_TLDS = new Set(['local', 'localhost', 'internal', 'lan', 'home', 'corp', 'private']);

const LABEL_PATTERN = /^(?:[a-z0-9]|_[a-z0-9])(?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function containsControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function normalizeHostname(input: string): string {
  return input.trim().replace(/\.+$/, '').toLowerCase();
}

export function validateDomain(input: string): string {
  if (typeof input !== 'string') {
    throw new InvalidDomainError(String(input), 'Domain must be a string');
  }

  if (containsControlChars(input)) {
    throw new InvalidDomainError(input, 'Domain contains invalid control characters');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidDomainError(input, 'Domain cannot be empty');
  }
  if (trimmed.length > 253) {
    throw new InvalidDomainError(trimmed, 'Domain exceeds maximum length of 253 characters');
  }

  let domain = normalizeHostname(trimmed);
  if (!domain) {
    throw new InvalidDomainError(input, 'Domain cannot be empty or just a dot');
  }

  const ip = parseIP(domain);
  if (ip) {
    throw new InvalidDomainError(domain, 'IP addresses cannot be looked up as domains');
  }

  if (LOCALHOST_NAMES.has(domain) || domain.endsWith('.localhost')) {
    throw new InvalidDomainError(domain, 'localhost is not supported');
  }

  const labels = domain.split('.');
  if (labels.length < 2) {
    throw new InvalidDomainError(domain, 'Domain must have at least two labels (e.g., example.com)');
  }

  const tld = labels[labels.length - 1];
  if (BLOCKED_TLDS.has(tld)) {
    throw new InvalidDomainError(domain, 'Internal or local hostnames are not supported');
  }

  for (const label of labels) {
    if (!label) {
      throw new InvalidDomainError(domain, 'Domain contains empty label');
    }
    if (label.length > 63) {
      throw new InvalidDomainError(domain, `Label exceeds maximum length of 63 characters`);
    }
    if (!LABEL_PATTERN.test(label)) {
      throw new InvalidDomainError(
        domain,
        `Label "${label}" contains invalid characters. Labels must start and end with alphanumeric characters (service labels may start with an underscore).`
      );
    }
  }

  return domain;
}

export function validateSelector(input: string): string {
  const selector = input.trim().toLowerCase();
  if (!selector) {
    throw new ValidationError('DKIM selector is required');
  }
  if (selector.length > 63) {
    throw new ValidationError('DKIM selector exceeds 63 characters');
  }
  if (!/^[a-z0-9]([a-z0-9._-]{0,61}[a-z0-9])?$/i.test(selector) && !/^[a-z0-9]$/i.test(selector)) {
    throw new ValidationError('DKIM selector contains invalid characters');
  }
  return selector;
}

export function validatePublicIP(input: string): { canonical: string; version: 4 | 6 } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError('IP address is required');
  }
  const parsed = parseIP(trimmed);
  if (!parsed) {
    throw new ValidationError('Invalid IP address');
  }
  const classification = classifyIP(parsed);
  if (classification !== 'public') {
    throw new ValidationError(`Lookups of ${classification} addresses are not allowed`);
  }
  return { canonical: parsed.canonical, version: parsed.version };
}

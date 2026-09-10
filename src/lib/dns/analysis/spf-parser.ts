import { SPFMechanism, SPFModifier, SPFParseResult } from '@/types/domain';

const MECHANISM_TYPES = new Set(['all', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'include', 'exists']);
const QUALIFIERS = new Set(['+', '-', '~', '?']);

export function parseSPFRecord(record: string): SPFParseResult {
  const errors: string[] = [];
  const mechanisms: SPFMechanism[] = [];
  const modifiers: SPFModifier[] = [];
  const tokens = record.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return { record, valid: false, mechanisms, modifiers, errors: ['Empty SPF record'] };
  }

  const version = tokens[0];
  if (version.toLowerCase() !== 'v=spf1') {
    errors.push('SPF record must start with v=spf1');
  }

  let sawAll = false;

  for (let i = 1; i < tokens.length; i += 1) {
    const raw = tokens[i];
    const eq = raw.indexOf('=');
    const looksLikeModifier = eq > 0 && !raw.slice(0, eq).includes(':');

    if (looksLikeModifier) {
      const name = raw.slice(0, eq).toLowerCase();
      const value = raw.slice(eq + 1);
      if (name !== 'redirect' && name !== 'exp') {
        errors.push(`Unknown modifier: ${name}`);
      }
      modifiers.push({ name, value, raw });
      continue;
    }

    let qualifier: SPFMechanism['qualifier'] = '+';
    let rest = raw;
    if (QUALIFIERS.has(raw[0])) {
      qualifier = raw[0] as SPFMechanism['qualifier'];
      rest = raw.slice(1);
    }

    const colon = rest.indexOf(':');
    const slash = rest.indexOf('/');
    let type: string;
    let value = '';
    if (colon >= 0) {
      type = rest.slice(0, colon).toLowerCase();
      value = rest.slice(colon + 1);
    } else if (slash >= 0 && ['a', 'mx'].includes(rest.slice(0, slash).toLowerCase())) {
      type = rest.slice(0, slash).toLowerCase();
      value = rest.slice(slash);
    } else {
      type = rest.toLowerCase();
    }

    if (type.includes('/')) {
      const [base, cidr] = type.split('/');
      type = base;
      value = value ? value : `/${cidr}`;
    }

    if (!MECHANISM_TYPES.has(type)) {
      errors.push(`Unknown mechanism: ${raw}`);
      continue;
    }

    if (type === 'all') {
      sawAll = true;
      if (i !== tokens.length - 1 && !tokens.slice(i + 1).every((t) => t.includes('='))) {
        errors.push('The all mechanism should be the last mechanism');
      }
    }

    mechanisms.push({ type, qualifier, value, raw });
  }

  const redirect = modifiers.find((m) => m.name === 'redirect');
  if (sawAll && redirect) {
    errors.push('redirect is ignored when an all mechanism is present');
  }

  return {
    record,
    version: version.toLowerCase() === 'v=spf1' ? 'spf1' : version,
    valid: errors.length === 0,
    mechanisms,
    modifiers,
    errors,
  };
}

export function isSpfRecord(txt: string): boolean {
  return /^v=spf1(?:\s|$)/i.test(txt.trim());
}

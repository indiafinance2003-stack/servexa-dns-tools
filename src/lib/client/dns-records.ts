import { DNSRecordType } from '@/types/domain';

/**
 * Pure helpers that turn normalized backend DNS records into presentation
 * rows for the DNS Lookup table (TYPE | NAME | VALUE / TARGET | TTL).
 *
 * Rules enforced here:
 * - Never fabricate TTL: when the backend does not supply one, render "—".
 * - Never invent values: unknown shapes fall back to their raw JSON.
 */

export const TTL_UNAVAILABLE = '—';

export interface DnsRecordRow {
  key: string;
  type: string;
  name: string;
  value: string;
  ttl: string;
  raw: unknown;
}

export interface SoaField {
  label: string;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function trimTrailingDot(value: string): string {
  return value.replace(/\.+$/, '');
}

function asNumberString(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function formatTtl(ttl: unknown): string {
  if (typeof ttl === 'number' && Number.isFinite(ttl) && ttl >= 0) {
    return `${ttl}s`;
  }
  return TTL_UNAVAILABLE;
}

function compactValue(entry: Record<string, unknown>): string {
  const skip = new Set(['type', 'name', 'hostname', 'domain', 'ttl']);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(entry)) {
    if (skip.has(key)) continue;
    if (typeof value === 'string') parts.push(value);
    else if (typeof value === 'number') parts.push(String(value));
    if (parts.length >= 2) break;
  }
  return parts.join(' ');
}

function rowFromEntry(
  entry: Record<string, unknown>,
  recordType: string,
  index: number,
  fallbackDomain: string
): DnsRecordRow {
  const nameCandidates = ['name', 'hostname', 'domain'];
  let name = '';
  for (const key of nameCandidates) {
    const candidate = entry[key];
    if (typeof candidate === 'string' && candidate) {
      name = trimTrailingDot(candidate);
      break;
    }
  }
  if (!name) name = fallbackDomain;

  let value = '';
  if (typeof entry.raw === 'string') value = entry.raw;
  if (!value) value = compactValue(entry);
  if (!value) value = JSON.stringify(entry);

  return {
    key: `${recordType}-${index}`,
    type: recordType,
    name,
    value,
    ttl: formatTtl(entry.ttl),
    raw: entry,
  };
}

export function buildRecordRows(
  recordType: DNSRecordType | string,
  records: unknown,
  fallbackDomain: string
): DnsRecordRow[] {
  if (!Array.isArray(records)) return [];
  const domain = fallbackDomain || '';
  const type = String(recordType);

  const rows: DnsRecordRow[] = records.map((record, index) => {
    const key = `${type}-${index}`;

    // Plain string record shapes (CNAME, TXT, PTR).
    if (typeof record === 'string') {
      return { key, type, name: domain, value: trimTrailingDot(record), ttl: TTL_UNAVAILABLE, raw: record };
    }
    if (!isRecord(record)) {
      return { key, type, name: domain, value: String(record), ttl: TTL_UNAVAILABLE, raw: record };
    }

    switch (type) {
      case DNSRecordType.A:
      case DNSRecordType.AAAA: {
        const address = asString(record.address);
        return {
          key,
          type,
          name: domain,
          value: address || JSON.stringify(record),
          ttl: formatTtl(record.ttl),
          raw: record,
        };
      }
      case DNSRecordType.MX: {
        const priority = asNumberString(record.priority);
        const exchange = trimTrailingDot(asString(record.exchange));
        return {
          key,
          type,
          name: domain,
          value: priority
            ? `${priority} ${exchange || JSON.stringify(record)}`
            : exchange || JSON.stringify(record),
          ttl: formatTtl(record.ttl),
          raw: record,
        };
      }
      case DNSRecordType.NS: {
        const nameserver = trimTrailingDot(asString(record.nameserver));
        return {
          key,
          type,
          name: domain,
          value: nameserver || JSON.stringify(record),
          ttl: formatTtl(record.ttl),
          raw: record,
        };
      }
      case DNSRecordType.SRV: {
        const priority = asNumberString(record.priority);
        const weight = asNumberString(record.weight);
        const port = asNumberString(record.port);
        const target = trimTrailingDot(asString(record.target));
        const parts = [priority, weight, port].filter(Boolean).join(' ');
        const value = target
          ? parts
            ? `${parts} ${target}`
            : target
          : parts || JSON.stringify(record);
        return { key, type, name: domain, value, ttl: formatTtl(record.ttl), raw: record };
      }
      case DNSRecordType.CAA: {
        const flags = asNumberString(record.flags);
        const tag = asString(record.tag);
        const caaValue = asString(record.value);
        const composed = [flags, tag, caaValue ? `"${caaValue}"` : ''].filter(Boolean).join(' ');
        return {
          key,
          type,
          name: domain,
          value: composed || JSON.stringify(record),
          ttl: formatTtl(record.ttl),
          raw: record,
        };
      }
      case DNSRecordType.SOA: {
        const nameserver = trimTrailingDot(asString(record.nameserver));
        const serial = asNumberString(record.serial);
        const composed = [nameserver, serial ? `serial ${serial}` : ''].filter(Boolean).join(' · ');
        return {
          key,
          type,
          name: domain,
          value: composed || JSON.stringify(record),
          ttl: formatTtl(record.ttl),
          raw: record,
        };
      }
      default:
        return rowFromEntry(record, type, index, domain);
    }
  });

  return rows;
}

/**
 * Structured SOA fields for the dedicated SOA presentation block.
 * Values come only from the backend record; missing numbers render "—".
 */
export function buildSoaFields(soa: unknown): SoaField[] {
  if (!isRecord(soa)) return [];
  const fields: Array<[string, unknown]> = [
    ['Primary nameserver', soa.nameserver],
    ['Responsible mailbox', soa.hostmaster],
    ['Serial', soa.serial],
    ['Refresh', soa.refresh],
    ['Retry', soa.retry],
    ['Expire', soa.expire],
    ['Minimum TTL', soa.minimum],
    ['Record TTL', soa.ttl],
  ];
  return fields.map(([label, value]) => ({
    label,
    value: value === undefined || value === null ? TTL_UNAVAILABLE : String(value),
  }));
}

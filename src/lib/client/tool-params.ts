import { DNSRecordType } from '@/types/domain';

/**
 * Parses URL search parameters into prefill values for tool components.
 * Defensive by design: unknown or oversized values are ignored so a crafted
 * URL cannot inject unexpected content into forms. This module is pure and
 * shared by server pages and unit tests.
 */

export interface ToolParams {
  domain?: string;
  recordType?: DNSRecordType;
  selector?: string;
  ip?: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const RECORD_TYPE_VALUES = new Set<string>(Object.values(DNSRecordType));

function firstString(value: string | string[] | undefined, max: number): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function stripUrlPrefix(input: string): string {
  // Users often paste "https://example.com/" — take the host part only.
  const withoutProtocol = input.replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0];
  return host.replace(/\.+$/, '');
}

export function parseToolSearchParams(params: RawSearchParams): ToolParams {
  const result: ToolParams = {};

  const domain = firstString(params.domain, 253);
  if (domain) {
    const cleaned = stripUrlPrefix(domain);
    if (cleaned) result.domain = cleaned;
  }

  const recordType = (firstString(params.recordType, 8) || firstString(params.type, 8))?.toUpperCase();
  if (recordType && RECORD_TYPE_VALUES.has(recordType)) {
    result.recordType = recordType as DNSRecordType;
  }

  const selector = firstString(params.selector, 63);
  if (selector && /^[a-z0-9][a-z0-9._-]*$/i.test(selector)) {
    result.selector = selector;
  }

  const ip = firstString(params.ip, 64);
  if (ip) result.ip = ip;

  return result;
}

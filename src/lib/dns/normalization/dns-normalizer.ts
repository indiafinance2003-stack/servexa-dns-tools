import {
  AddressRecord,
  MXRecord,
  NSRecord,
  SRVRecord,
  CAARecord,
  SOARecord,
  DNSRecordType,
} from '@/types/domain';

export function normalizeARecords(records: unknown[]): AddressRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (typeof record === 'string') return { address: record };
      if (record && typeof record === 'object' && 'address' in record) {
        const r = record as { address: unknown; ttl?: unknown };
        return {
          address: String(r.address),
          ...(typeof r.ttl === 'number' ? { ttl: r.ttl } : {}),
        };
      }
      return null;
    })
    .filter((r): r is AddressRecord => r !== null);
}

export function normalizeAAAARecords(records: unknown[]): AddressRecord[] {
  return normalizeARecords(records);
}

export function normalizeMXRecords(records: unknown[]): MXRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (record && typeof record === 'object' && 'priority' in record && 'exchange' in record) {
        const r = record as { priority: unknown; exchange: unknown; ttl?: unknown };
        return {
          priority: Number(r.priority),
          exchange: String(r.exchange).replace(/\.+$/, ''),
          ...(typeof r.ttl === 'number' ? { ttl: r.ttl } : {}),
        };
      }
      return null;
    })
    .filter((r): r is MXRecord => r !== null);
}

export function normalizeNSRecords(records: unknown[]): NSRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (typeof record === 'string') {
        return { nameserver: record.replace(/\.+$/, '') };
      }
      return null;
    })
    .filter((r): r is NSRecord => r !== null);
}

export function flattenTxtChunks(record: unknown): string {
  if (typeof record === 'string') return record;
  if (Array.isArray(record)) return record.map(flattenTxtChunks).join('');
  return String(record);
}

export function normalizeTXTRecords(records: unknown[]): string[] {
  if (!Array.isArray(records)) return [];
  return records.map(flattenTxtChunks);
}

export function normalizeSOARecord(record: unknown): SOARecord | null {
  if (record && typeof record === 'object' && 'nsname' in record && 'hostmaster' in record && 'serial' in record) {
    const r = record as Record<string, unknown>;
    return {
      nameserver: String(r.nsname).replace(/\.+$/, ''),
      hostmaster: String(r.hostmaster),
      serial: Number(r.serial),
      refresh: Number(r.refresh || 0),
      retry: Number(r.retry || 0),
      expire: Number(r.expire || 0),
      minimum: Number(r.minttl ?? r.minimum ?? 0),
    };
  }
  return null;
}

export function normalizeSRVRecords(records: unknown[]): SRVRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (
        record &&
        typeof record === 'object' &&
        'priority' in record &&
        'weight' in record &&
        'port' in record &&
        'name' in record
      ) {
        const r = record as Record<string, unknown>;
        return {
          priority: Number(r.priority),
          weight: Number(r.weight),
          port: Number(r.port),
          target: String(r.name).replace(/\.+$/, ''),
        };
      }
      return null;
    })
    .filter((r): r is SRVRecord => r !== null);
}

export function normalizeCAARecords(records: unknown[]): CAARecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (!record || typeof record !== 'object') return null;
      const r = record as Record<string, unknown>;
      if (typeof r.tag === 'string' && r.value !== undefined) {
        return {
          flags: Number(r.flags ?? r.critical ?? 0),
          tag: String(r.tag),
          value: String(r.value),
        };
      }
      const tag = ['issue', 'issuewild', 'iodef'].find((key) => r[key] !== undefined);
      if (tag) {
        return {
          flags: r.critical ? 1 : 0,
          tag,
          value: String(r[tag]),
        };
      }
      return null;
    })
    .filter((r): r is CAARecord => r !== null);
}

export function normalizeCNAMERecords(records: unknown[]): string[] {
  if (!Array.isArray(records)) return [];
  return records.filter((r): r is string => typeof r === 'string').map((r) => r.replace(/\.+$/, ''));
}

export function normalizePTRRecords(records: unknown[]): string[] {
  if (!Array.isArray(records)) return [];
  return records.filter((r): r is string => typeof r === 'string').map((r) => r.replace(/\.+$/, ''));
}

export function normalizeDNSRecord(recordType: DNSRecordType, records: unknown[]): unknown[] {
  switch (recordType) {
    case DNSRecordType.A:
      return normalizeARecords(records);
    case DNSRecordType.AAAA:
      return normalizeAAAARecords(records);
    case DNSRecordType.MX:
      return normalizeMXRecords(records);
    case DNSRecordType.NS:
      return normalizeNSRecords(records);
    case DNSRecordType.TXT:
      return normalizeTXTRecords(records);
    case DNSRecordType.SOA: {
      const soa = normalizeSOARecord(records[0]);
      return soa ? [soa] : [];
    }
    case DNSRecordType.SRV:
      return normalizeSRVRecords(records);
    case DNSRecordType.CAA:
      return normalizeCAARecords(records);
    case DNSRecordType.CNAME:
      return normalizeCNAMERecords(records);
    case DNSRecordType.PTR:
      return normalizePTRRecords(records);
    default:
      return records;
  }
}

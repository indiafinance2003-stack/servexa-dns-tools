import { config } from '@/lib/config';
import { DNSError } from '@/lib/errors/app-error';
import { AppErrorCode } from '@/lib/errors/app-error';
import { DNSLookupResult, DNSLookupStatus, DNSRecordType } from '@/types/domain';

export class QueryBudget {
  remaining: number;

  constructor(limit: number = config.MAX_DNS_QUERIES_PER_REQUEST) {
    this.remaining = limit;
  }

  tryTake(count = 1): boolean {
    if (this.remaining < count) return false;
    this.remaining -= count;
    return true;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`DNS query timeout (>${ms}ms)`) as NodeJS.ErrnoException;
      error.code = 'ETIMEOUT';
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function mapErrorStatus(err: NodeJS.ErrnoException): { status: DNSLookupStatus; message: string } {
  const code = err.code || '';
  if (code === 'ENOTFOUND' || code === 'ENOTIMP') {
    return { status: 'nxdomain', message: 'Domain does not exist (NXDOMAIN)' };
  }
  if (code === 'ENODATA' || code === 'EADDRNOTFOUND' || code === 'EREFUSEDNODATA') {
    return { status: 'empty', message: 'No records of the requested type (NOERROR / NODATA)' };
  }
  if (code === 'ESERVFAIL') {
    return { status: 'servfail', message: 'DNS server failure (SERVFAIL)' };
  }
  if (code === 'EREFUSED' || code === 'ECONNREFUSED') {
    return { status: 'refused', message: 'DNS query refused (REFUSED)' };
  }
  if (code === 'ETIMEOUT' || code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return { status: 'timeout', message: `DNS query timeout (>${config.DNS_QUERY_TIMEOUT_MS}ms)` };
  }
  if (code === 'EBADNAME' || code === 'EINVAL') {
    return { status: 'error', message: 'Malformed DNS name' };
  }
  return { status: 'error', message: 'DNS resolution failed' };
}

export async function resolveDNS(
  domain: string,
  recordType: DNSRecordType,
  options?: { servers?: string[]; budget?: QueryBudget }
): Promise<DNSLookupResult> {
  const startTime = Date.now();
  if (options?.budget && !options.budget.tryTake(1)) {
    return {
      domain,
      recordType,
      records: [],
      status: 'error',
      error: 'DNS query budget for this request has been exhausted',
      queryTime: 0,
      resolver: options.servers?.[0],
    };
  }

  try {
    const dns = await import('dns');
    const resolver = new dns.promises.Resolver();
    if (options?.servers?.length) {
      resolver.setServers(options.servers);
    }

    const timeout = config.DNS_QUERY_TIMEOUT_MS;
    let records: unknown[] = [];

    switch (recordType) {
      case DNSRecordType.A:
        records = await withTimeout(resolver.resolve4(domain, { ttl: true }), timeout);
        break;
      case DNSRecordType.AAAA:
        records = await withTimeout(resolver.resolve6(domain, { ttl: true }), timeout);
        break;
      case DNSRecordType.CNAME:
        records = await withTimeout(resolver.resolveCname(domain), timeout);
        break;
      case DNSRecordType.MX:
        records = await withTimeout(resolver.resolveMx(domain), timeout);
        break;
      case DNSRecordType.NS:
        records = await withTimeout(resolver.resolveNs(domain), timeout);
        break;
      case DNSRecordType.TXT:
        records = await withTimeout(resolver.resolveTxt(domain), timeout);
        break;
      case DNSRecordType.SOA:
        records = [await withTimeout(resolver.resolveSoa(domain), timeout)];
        break;
      case DNSRecordType.PTR:
        records = await withTimeout(resolver.resolvePtr(domain), timeout);
        break;
      case DNSRecordType.SRV:
        records = await withTimeout(resolver.resolveSrv(domain), timeout);
        break;
      case DNSRecordType.CAA:
        records = await withTimeout(resolver.resolveCaa(domain), timeout);
        break;
      default:
        throw new DNSError(`Unsupported record type: ${recordType}`, AppErrorCode.UNSUPPORTED_OPERATION);
    }

    return {
      domain,
      recordType,
      records,
      status: records.length === 0 ? 'empty' : 'success',
      queryTime: Date.now() - startTime,
      resolver: options?.servers?.[0],
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const mapped = mapErrorStatus(err);
    return {
      domain,
      recordType,
      records: [],
      status: mapped.status,
      error: mapped.message,
      queryTime: Date.now() - startTime,
      resolver: options?.servers?.[0],
    };
  }
}

export async function resolveSpecial(
  name: string,
  rrtype: string,
  options?: { budget?: QueryBudget }
): Promise<{ records: unknown[]; status: DNSLookupStatus; error?: string; queryTime: number }> {
  const startTime = Date.now();
  if (options?.budget && !options.budget.tryTake(1)) {
    return {
      records: [],
      status: 'error',
      error: 'DNS query budget for this request has been exhausted',
      queryTime: 0,
    };
  }
  try {
    const dns = await import('dns');
    const resolver = new dns.promises.Resolver();
    const records = await withTimeout(
      resolver.resolve(name, rrtype as 'A'),
      config.DNS_QUERY_TIMEOUT_MS
    );
    const list = Array.isArray(records) ? records : [records];
    return {
      records: list,
      status: list.length === 0 ? 'empty' : 'success',
      queryTime: Date.now() - startTime,
    };
  } catch (error) {
    const mapped = mapErrorStatus(error as NodeJS.ErrnoException);
    return {
      records: [],
      status: mapped.status,
      error: mapped.message,
      queryTime: Date.now() - startTime,
    };
  }
}

import { promises as dns } from 'dns';
import { config } from '@/lib/config';
import { BlockedTargetError, TargetUnreachableError } from '@/lib/errors/app-error';
import { classifyIP, parseIP } from '@/lib/net/ip';

/**
 * Resolves a hostname to a small, ordered list of *public unicast* addresses.
 *
 * This is the single place where a hostname is turned into connectable
 * addresses. Callers then connect to one of the returned IP addresses
 * directly, so the hostname is never re-resolved between the safety check and
 * the connection (which is what makes the DNS-rebinding class of SSRF attacks
 * inapplicable here).
 */

export interface PublicAddress {
  address: string;
  family: 4 | 6;
  /** Classification result for auditing / diagnostics. */
  classification: 'public';
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
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

export async function resolvePublicAddresses(
  hostname: string,
  maxAddresses: number = config.HTTP_MAX_ADDRESS_ATTEMPTS
): Promise<PublicAddress[]> {
  const literal = parseIP(hostname);
  if (literal) {
    // Literals are validated by the caller; re-check here as defence in depth.
    if (classifyIP(literal) !== 'public') {
      throw new BlockedTargetError(
        `Targets in the ${classifyIP(literal)} address range are not supported. Ravelyth only tests publicly reachable hosts.`
      );
    }
    return [{ address: literal.canonical, family: literal.version, classification: 'public' }];
  }

  let results: Array<{ address: string; family: number }>;
  try {
    results = await withTimeout(
      dns.lookup(hostname, { all: true, verbatim: true }),
      config.DNS_QUERY_TIMEOUT_MS,
      () => {
        const error = new Error('DNS lookup timed out') as NodeJS.ErrnoException;
        error.code = 'ETIMEOUT';
        return error;
      }
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (code === 'ENOTFOUND' || code === 'EAI_NODATA') {
      throw new TargetUnreachableError(`${hostname} did not resolve in DNS (NXDOMAIN).`);
    }
    if (code === 'ETIMEOUT' || code === 'EAI_AGAIN' || code === 'ETIMEDOUT') {
      throw new TargetUnreachableError(`DNS lookup for ${hostname} did not complete in time.`);
    }
    throw new TargetUnreachableError(`DNS lookup for ${hostname} failed.`);
  }

  const accepted: PublicAddress[] = [];
  const rejected = new Set<string>();

  for (const result of results) {
    const parsed = parseIP(String(result.address));
    if (!parsed) continue;
    const classification = classifyIP(parsed);
    if (classification !== 'public') {
      rejected.add(classification);
      continue;
    }
    const family = parsed.version;
    if (accepted.some((item) => item.address === parsed.canonical)) continue;
    accepted.push({ address: parsed.canonical, family, classification: 'public' });
    if (accepted.length >= Math.max(1, maxAddresses)) break;
  }

  if (accepted.length === 0) {
    if (rejected.size > 0) {
      throw new BlockedTargetError(
        `${hostname} resolves only to ${[...rejected].join(' / ')} addresses. Ravelyth does not connect to non-public hosts.`
      );
    }
    throw new TargetUnreachableError(`${hostname} did not resolve to any address.`);
  }

  return accepted;
}

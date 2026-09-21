import 'server-only';
import { parseIP, classifyIP } from './ip';
import { validateServiceUrl } from './target';
import type { DomainInfoResult, RdapNetworkResult } from '@/types/domain';

/**
 * RDAP (Registration Data Access Protocol) lookups.
 *
 * Sources come ONLY from IANA's published bootstrap files, so a top-level
 * domain or IP is never sent to an endpoint we did not learn about from the
 * registries themselves. Every request has a hard timeout (whole call,
 * redirects included) and a response size cap enforced before the body is
 * buffered, and every redirect target is re-validated (HTTPS + public host,
 * ports 80/443) before it is followed. Every failure degrades to `null` (the
 * diagnostic UI says "could not be determined" instead of inventing a provider).
 *
 * Privacy: contacts are reduced to organization names where published, and
 * emails are dropped unless the registry returns a real address (redacted
 * placeholders like "REDACTED FOR PRIVACY" are omitted).
 */

const IANA = 'https://data.iana.org/rdap';
const FETCH_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;

interface BootstrapEntry {
  prefixes: string[];
  urls: string[];
}

class BootstrapCache {
  private tlds = new Map<string, string[]>();
  private prefixes4: Array<{ start: bigint; end: bigint; urls: string[] }> = [];
  private prefixes6: Array<{ start: bigint; end: bigint; urls: string[] }> = [];
  private loadedAt: number | null = null;

  private static readonly TTL_MS = 12 * 60 * 60 * 1000; // 12h

  private stale(): boolean {
    return this.loadedAt === null || Date.now() - this.loadedAt > BootstrapCache.TTL_MS;
  }

  async ensure(): Promise<void> {
    if (!this.stale()) return;
    try {
      const [dnsJson, v4Json, v6Json] = await Promise.all([
        fetchBootstrap(`${IANA}/dns.json`),
        fetchBootstrap(`${IANA}/ipv4.json`),
        fetchBootstrap(`${IANA}/ipv6.json`),
      ] as [Promise<Record<string, unknown>>, Promise<Record<string, unknown>>, Promise<Record<string, unknown>>]);

      this.tlds = new Map<string, string[]>();
      const toEntries = (servicesField: unknown): BootstrapEntry[] => {
        if (Array.isArray(servicesField)) {
          return servicesField
            .filter((item): item is unknown[] => Array.isArray(item) && item.length === 2)
            .map((item) => ({
              prefixes: (item[0] as unknown[]).filter(
                (value): value is string => typeof value === 'string'
              ),
              urls: (item[1] as unknown[]).filter((value): value is string => typeof value === 'string'),
            }))
            .filter((entry) => entry.urls.length > 0);
        }
        return [];
      };

      for (const entry of toEntries(dnsJson.services)) {
        for (const prefix of entry.prefixes) {
          const tld = prefix.toLowerCase().replace(/^\./, '');
          if (tld.length > 0) this.tlds.set(tld, entry.urls);
        }
      }

      this.prefixes4 = [];
      for (const entry of toEntries(v4Json.services)) {
        for (const prefix of entry.prefixes) {
          const range = prefixRangeV4(prefix);
          if (range) this.prefixes4.push({ ...range, urls: entry.urls });
        }
      }

      this.prefixes6 = [];
      for (const entry of toEntries(v6Json.services)) {
        for (const prefix of entry.prefixes) {
          const range = prefixRangeV6(prefix);
          if (range) this.prefixes6.push({ ...range, urls: entry.urls });
        }
      }

      this.loadedAt = Date.now();
    } catch {
      // The old bootstrap stays cached; first-ever calls simply return nothing.
    }
  }

  baseUrlForTld(tld: string): string | null {
    return this.tlds.get(tld.toLowerCase())?.[0] ?? null;
  }

  baseUrlForIp(ip: string): string | null {
    const parsed = parseIP(ip);
    if (!parsed) return null;
    const list = parsed.version === 4 ? this.prefixes4 : this.prefixes6;
    const value = parsed.version === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
    if (value === null) return null;
    for (const entry of list) {
      if (value >= entry.start && value <= entry.end) return entry.urls[0];
    }
    return null;
  }
}

const bootstrap = new BootstrapCache();

async function fetchBootstrap(url: string): Promise<Record<string, unknown>> {
  const { text } = await rdapGet(url);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Malformed bootstrap file');
  }
  return parsed;
}

/**
 * One capped, time-boxed GET. Redirects are followed manually so that every
 * hop target is re-validated before connecting; the size cap is enforced while
 * the body streams, before it is fully buffered.
 */
async function rdapGet(url: string): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let target = validateServiceUrl(url, { httpsOnly: true }).toString();
    let redirects = 0;
    while (true) {
      const response = await fetch(target, {
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'manual',
        headers: { Accept: 'application/rdap+json' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) {
          return { status: response.status, text: '' };
        }
        redirects += 1;
        if (redirects > MAX_REDIRECTS) {
          throw new Error('RDAP redirect limit exceeded');
        }
        target = validateServiceUrl(new URL(location, target).toString(), { httpsOnly: true }).toString();
        continue;
      }

      const text = await readCapped(response, MAX_BODY_BYTES);
      return { status: response.status, text };
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a response body, rejecting it as soon as it exceeds `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error('RDAP response too large');
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('RDAP response too large');
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error('RDAP response too large');
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function ipv4ToBigInt(ip: string): bigint | null {
  const parsed = parseIP(ip);
  if (!parsed || parsed.version !== 4) return null;
  return (
    (BigInt(parsed.octets[0]) << 24n) |
    (BigInt(parsed.octets[1]) << 16n) |
    (BigInt(parsed.octets[2]) << 8n) |
    BigInt(parsed.octets[3])
  );
}

function prefixRangeV4(prefix: string): { start: bigint; end: bigint } | null {
  const [network, bitsText] = prefix.split('/');
  const bits = Number.parseInt(bitsText ?? '32', 10);
  if (!network || Number.isNaN(bits) || bits < 0 || bits > 32) return null;
  const value = ipv4ToBigInt(network);
  if (value === null) return null;
  const shift = 32 - bits;
  const mask = shift >= 64 ? 0n : (1n << BigInt(shift)) - 1n;
  return { start: value, end: value | mask };
}

function ipv6ToBigInt(ip: string): bigint | null {
  const parsed = parseIP(ip);
  if (!parsed || parsed.version !== 6) return null;
  let value = 0n;
  for (const group of parsed.groups) {
    value = (value << 16n) | BigInt(group);
  }
  return value;
}

function prefixRangeV6(prefix: string): { start: bigint; end: bigint } | null {
  const [network, bitsText] = prefix.split('/');
  const bits = Number.parseInt(bitsText ?? '128', 10);
  if (!network || Number.isNaN(bits) || bits < 0 || bits > 128) return null;
  const base = ipv6ToBigInt(network);
  if (base === null) return null;
  const shift = 128 - bits;
  const mask = shift >= 128 ? 0n : (1n << BigInt(shift)) - 1n;
  return { start: base, end: base | mask };
}

/** Longest-prefix match over the bootstrap list for a given IP. */
export function findNetworkForIp(ip: string): string | null {
  return bootstrap.baseUrlForIp(ip);
}

// ---------------------------------------------------------------------------
// Domain RDAP parsing
// ---------------------------------------------------------------------------

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function emailLooksReal(value: string): boolean {
  const clean = value.trim();
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) &&
    !/REDACTED/i.test(clean) &&
    !/for privacy/i.test(clean)
  );
}

function entityOrganization(entity: unknown): string | null {
  if (!entity || typeof entity !== 'object') return null;
  const vcard = (entity as { vcardArray?: unknown }).vcardArray;
  if (!Array.isArray(vcard) || vcard.length < 2 || !Array.isArray(vcard[1])) return null;
  for (const raw of vcard[1] as unknown[]) {
    if (!Array.isArray(raw) || raw.length < 3) continue;
    if (raw[0] === 'fn' || raw[0] === 'org') {
      const value = firstString(raw[3]);
      if (value && !/REDACTED|for privacy/i.test(value)) return value;
    }
  }
  return null;
}

/**
 * Reduces an RDAP domain object to the compact public view. Pure and exported
 * so the transformation is unit tested against real registry fixtures.
 */
export function parseRdapDomain(
  json: Record<string, unknown>,
  source: string,
  domain: string
): DomainInfoResult {
  const notes: string[] = [];

  const status = Array.isArray(json.status)
    ? json.status.filter((value): value is string => typeof value === 'string')
    : [];

  let registrar: string | null = null;
  const contacts: DomainInfoResult['contacts'] = [];
  const entities = Array.isArray(json.entities) ? (json.entities as unknown[]) : [];
  for (const entity of entities) {
    if (!entity || typeof entity !== 'object') continue;
    const roles = (entity as { roles?: unknown[] }).roles;
    const roleList = Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
    const hasRegistrar = roleList.includes('registrar');

    let org: string | null = null;
    let email: string | null = null;
    const vcard = (entity as { vcardArray?: unknown }).vcardArray;
    if (Array.isArray(vcard) && vcard.length > 1 && Array.isArray(vcard[1])) {
      for (const raw of vcard[1] as unknown[]) {
        if (!Array.isArray(raw) || raw.length < 3) continue;
        if (hasRegistrar && org === null && (raw[0] === 'fn' || raw[0] === 'org')) {
          const value = firstString(raw[3]);
          if (value && !/REDACTED|for privacy/i.test(value)) org = value;
        }
        if (email === null && raw[0] === 'email') {
          const value = firstString(raw[3]);
          if (value && emailLooksReal(value)) email = value;
        }
      }
    }
    if (hasRegistrar && org) registrar = org;
    if (hasRegistrar || roleList.length === 0) {
      contacts.push({ role: hasRegistrar ? 'registrar' : 'other', organization: org, email });
    }
  }

  const events: DomainInfoResult['events'] = [];
  const rawEvents = Array.isArray(json.events) ? (json.events as unknown[]) : [];
  for (const event of rawEvents) {
    if (!event || typeof event !== 'object') continue;
    const action = firstString((event as { eventAction?: unknown }).eventAction);
    const date = firstString((event as { eventDate?: unknown }).eventDate);
    if (action && date) events.push({ action, date });
  }

  const nameservers: DomainInfoResult['nameservers'] = [];
  const rawNs = Array.isArray(json.nameservers) ? (json.nameservers as unknown[]) : [];
  for (const ns of rawNs) {
    if (!ns || typeof ns !== 'object') continue;
    const name = firstString((ns as { ldhName?: unknown }).ldhName);
    if (name) {
      const addresses = (ns as { ipAddresses?: unknown }).ipAddresses;
      nameservers.push({
        name,
        addresses: Array.isArray(addresses)
          ? addresses.filter((value): value is string => typeof value === 'string')
          : [],
      });
    }
  }

  const secureDns = typeof json.secureDNS === 'object' && json.secureDNS !== null ? json.secureDNS : undefined;
  let dnssecSigned: boolean | null = null;
  if (secureDns && typeof (secureDns as { delegationSigned?: unknown }).delegationSigned === 'boolean') {
    dnssecSigned = (secureDns as { delegationSigned: boolean }).delegationSigned;
  }

  // A registry that does not list a TLD-specific expiry must not be quoted as one.
  if (events.filter((event) => event.action === 'expiration').length === 0) {
    notes.push('This source did not publish an expiration event.');
  }
  if (contacts.every((contact) => contact.organization === null && contact.email === null)) {
    notes.push('The registry redacted or omitted contact details.');
  }
  if (dnssecSigned === null) {
    notes.push('This source did not report DNSSEC status.');
  }

  return {
    domain,
    source,
    handle: firstString(json.handle),
    status,
    registrar,
    events: events.slice(0, 20),
    nameservers: nameservers.slice(0, 20),
    dnssecSigned,
    contacts: contacts.slice(0, 5),
    notes,
  };
}

/** Fetches RDAP for a registered domain, or null when unavailable. */
export async function lookupDomainInfo(domain: string): Promise<DomainInfoResult | null> {
  try {
    const tld = domain.split('.').pop() ?? '';
    if (!tld) return null;
    await bootstrap.ensure();
    const base = bootstrap.baseUrlForTld(tld);
    if (!base) return null;

    const url = `${base.replace(/\/+$/, '')}/domain/${encodeURIComponent(domain)}`;
    const { status, text } = await rdapGet(url);
    if (status === 404) return null;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parseRdapDomain(parsed, base, domain);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IP network RDAP parsing
// ---------------------------------------------------------------------------

/**
 * Reduces an RDAP IP-network object to the compact provider view. Pure and
 * exported so the transformation is unit tested against RIR fixtures.
 */
export function parseRdapNetwork(
  json: Record<string, unknown>,
  ip: string,
  _source: string
): RdapNetworkResult {
  const notes: string[] = [];

  const startAddress = firstString(json.startAddress) ?? ip;
  const endAddress = firstString(json.endAddress) ?? ip;
  const ipVersion = firstString(json.ipVersion)?.startsWith('4')
    ? 'v4'
    : firstString(json.ipVersion)?.startsWith('6')
      ? 'v6'
      : parseIP(ip)?.version === 6
        ? 'v6'
        : 'v4';

  let organization: string | null = null;
  const entities = Array.isArray(json.entities) ? (json.entities as unknown[]) : [];
  for (const entity of entities) {
    const org = entityOrganization(entity);
    if (org) {
      organization = org;
      break;
    }
  }

  if (!organization) {
    notes.push('The registry did not publish an organization name.');
  }

  return {
    ip,
    handle: firstString(json.handle),
    name: firstString(json.name),
    country: firstString(json.country),
    startAddress,
    endAddress,
    ipVersion,
    organization,
    notes,
  };
}

/** Fetches RDAP for one public IP address, or null when unavailable. */
export async function lookupIpNetwork(ip: string): Promise<RdapNetworkResult | null> {
  try {
    const parsed = parseIP(ip);
    if (!parsed || classifyIP(parsed) !== 'public') return null;

    await bootstrap.ensure();
    const base = bootstrap.baseUrlForIp(ip);
    if (!base) return null;

    const url = `${base.replace(/\/+$/, '')}/ip/${encodeURIComponent(ip)}`;
    const { status, text } = await rdapGet(url);
    if (status === 404) return null;
    const parsedJson = JSON.parse(text) as Record<string, unknown>;
    return parseRdapNetwork(parsedJson, ip, base);
  } catch {
    return null;
  }
}
import { describe, expect, it, vi } from 'vitest';
import { lookupDomainInfo } from '@/lib/net/rdap';

/**
 * Fetch-level RDAP tests. global.fetch is stubbed so the bootstrap load and the
 * registry request run against a controlled fake; every would-be failure path
 * must degrade to `null` (the "could not be determined" contract) rather than
 * inventing a provider.
 */

const IANA = 'https://data.iana.org/rdap';
const BASE = 'https://rdap.test/';

function bootstrapDnsJson(): { services: unknown[] } {
  return { services: [[['com'], [BASE]]] };
}

function minimalDomainJson(handle: string): Record<string, unknown> {
  return { handle, events: [] };
}

type FetchCall = { url: string; status: number; headers?: Record<string, string>; body?: BodyInit | null };

function stubFetch(calls: FetchCall[]) {
  const requested: string[] = [];
  const handler = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    requested.push(url);
    const match = calls.find((call) => call.url === url);
    if (!match) {
      return new Response(null, { status: 404 });
    }
    const headers: Record<string, string> = { 'content-type': 'application/rdap+json', ...match.headers };
    return new Response(match.body ?? null, { status: match.status, headers });
  };
  vi.stubGlobal('fetch', handler);
  return { getRequested: () => [...requested] };
}

function bootCalls(calls: FetchCall[]) {
  calls.push(
    { url: `${IANA}/ipv4.json`, status: 200, body: JSON.stringify({ services: [] }) },
    { url: `${IANA}/ipv6.json`, status: 200, body: JSON.stringify({ services: [] }) }
  );
  return calls;
}

describe('lookupDomainInfo (fetch level)', () => {
  it('bootstraps the TLD services and parses a successful registry response', async () => {
    const { getRequested } = stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        { url: `${BASE}domain/example.com`, status: 200, body: JSON.stringify(minimalDomainJson('H1')) },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result).not.toBeNull();
    expect(result?.handle).toBe('H1');
    expect(result?.source).toBe(BASE);
    expect(getRequested()).toContain(`${BASE}domain/example.com`);
  });

  it('follows a validated redirect and parses the final response', async () => {
    stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        {
          url: `${BASE}domain/example.com`,
          status: 302,
          headers: { location: `${BASE}v2/domain/example.com` },
        },
        { url: `${BASE}v2/domain/example.com`, status: 200, body: JSON.stringify(minimalDomainJson('H2')) },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result?.handle).toBe('H2');
  });

  it('refuses to follow a redirect downgrade to plain HTTP (httpsOnly), returning null', async () => {
    const { getRequested } = stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        {
          url: `${BASE}domain/example.com`,
          status: 302,
          headers: { location: 'http://rdap-mirror.invalid/domain/example.com' },
        },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result).toBeNull();
    expect(getRequested().some((url) => url.startsWith('http://'))).toBe(false);
  });

  it('refuses a redirect to a private host even over https, returning null', async () => {
    const { getRequested } = stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        {
          url: `${BASE}domain/example.com`,
          status: 302,
          headers: { location: 'https://127.0.0.1/domain/example.com' },
        },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result).toBeNull();
    expect(getRequested().some((url) => url.includes('127.0.0.1'))).toBe(false);
  });

  it('stops after the redirect limit instead of chasing a loop', async () => {
    const calls: FetchCall[] = [
      { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
    ];
    for (let i = 0; i < 7; i += 1) {
      calls.push({
        url: i === 0 ? `${BASE}domain/example.com` : `${BASE}loop/${i}`,
        status: 302,
        headers: { location: `${BASE}loop/${i + 1}` },
      });
    }
    stubFetch(calls);

    const result = await lookupDomainInfo('example.com');

    expect(result).toBeNull();
  });

  it('rejects a response whose declared content-length exceeds the cap', async () => {
    stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        {
          url: `${BASE}domain/example.com`,
          status: 200,
          headers: { 'content-length': '9999999999' },
          body: JSON.stringify(minimalDomainJson('BIG')),
        },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result).toBeNull();
  });

  it('rejects a body that streams past the cap even without a content-length', async () => {
    stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        {
          url: `${BASE}domain/example.com`,
          status: 200,
          headers: {},
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(500_000).fill(65));
              controller.enqueue(new Uint8Array(600_000).fill(65));
              controller.close();
            },
          }),
        },
      ])
    );

    const result = await lookupDomainInfo('example.com');

    expect(result).toBeNull();
  });

  it('returns null for a 404 and never claims an absent domain is registered', async () => {
    stubFetch(
      bootCalls([
        { url: `${IANA}/dns.json`, status: 200, body: JSON.stringify(bootstrapDnsJson()) },
        { url: `${BASE}domain/notpresent.example`, status: 404 },
      ])
    );

    const result = await lookupDomainInfo('notpresent.example');

    expect(result).toBeNull();
  });
});
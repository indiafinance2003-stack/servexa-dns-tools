import { describe, expect, it } from 'vitest';
import { parseRdapDomain, parseRdapNetwork } from '@/lib/net/rdap';

describe('parseRdapDomain', () => {
  it('extracts registrar, events, nameservers and DNSSEC from a registry response', () => {
    const json = {
      handle: 'D37223957-COM',
      status: ['client transfer prohibited', 'client update prohibited'],
      events: [
        { eventAction: 'registration', eventDate: '2002-09-13T18:09:33+00:00' },
        { eventAction: 'expiration', eventDate: '2027-09-12T23:59:59+00:00' },
        { eventAction: 'last changed', eventDate: '2026-05-05T18:00:00+00:00' },
      ],
      nameservers: [
        { ldhName: 'NS1.EXAMPLE.COM', ipAddresses: ['192.0.2.10'] },
        { ldhName: 'NS2.EXAMPLE.COM' },
      ],
      secureDNS: { delegationSigned: true, maxSigLife: 7 },
      entities: [
        {
          roles: ['registrar'],
          vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar LLC']]],
        },
        {
          roles: ['registrant'],
          vcardArray: [
            'vcard',
            [
              ['fn', {}, 'text', 'REDACTED FOR PRIVACY'],
              ['email', {}, 'text', 'REDACTED FOR PRIVACY'],
            ],
          ],
        },
      ],
    };

    const result = parseRdapDomain(json, 'https://rdap.verisign.com/com/v1/', 'example.com');

    expect(result.domain).toBe('example.com');
    expect(result.source).toBe('https://rdap.verisign.com/com/v1/');
    expect(result.registrar).toBe('Example Registrar LLC');
    expect(result.status).toContain('client transfer prohibited');
    expect(result.events.find((e) => e.action === 'expiration')?.date).toBe(
      '2027-09-12T23:59:59+00:00'
    );
    expect(result.nameservers).toHaveLength(2);
    expect(result.nameservers[0]).toEqual({ name: 'NS1.EXAMPLE.COM', addresses: ['192.0.2.10'] });
    expect(result.dnssecSigned).toBe(true);
    expect(result.contacts).toHaveLength(1); // redacted registrant is omitted
    expect(result.contacts[0].organization).toBe('Example Registrar LLC');
    expect(result.contacts[0].email).toBeNull(); // no email published
    expect(result.notes).toEqual([]); // nothing was missing, so nothing is flagged
  });

  it('flags missing expiration, contacts and DNSSEC', () => {
    const result = parseRdapDomain(
      { handle: 'X', secureDNS: {} },
      'https://rdap.example/',
      'example.com'
    );
    expect(result.registrar).toBeNull();
    expect(result.dnssecSigned).toBeNull();
    expect(result.events).toEqual([]);
    expect(result.contacts).toEqual([]);
    expect(result.notes).toEqual([
      'This source did not publish an expiration event.',
      'The registry redacted or omitted contact details.',
      'This source did not report DNSSEC status.',
    ]);
  });

  it('omits registrar role when the registry does not publish one', () => {
    const result = parseRdapDomain({}, 'https://rdap.example/', 'example.com');
    expect(result.registrar).toBeNull();
    expect(result.events).toEqual([]);
    expect(result.nameservers).toEqual([]);
    expect(result.dnssecSigned).toBeNull();
  });
});

describe('parseRdapNetwork', () => {
  it('extracts network metadata and a published organization', () => {
    const json = {
      handle: 'NET-192-0-2-0-1',
      startAddress: '192.0.2.0',
      endAddress: '192.0.2.255',
      ipVersion: 'v4',
      name: 'EXAMPLE-NETWORK',
      type: 'DIRECT ALLOCATION',
      country: 'US',
      entities: [
        {
          vcardArray: ['vcard', [['fn', {}, 'text', 'Example Networks Inc.']]],
        },
      ],
    };

    const result = parseRdapNetwork(json, '192.0.2.10', 'https://rdap.arin.net/registry/');

    expect(result.ip).toBe('192.0.2.10');
    expect(result.handle).toBe('NET-192-0-2-0-1');
    expect(result.name).toBe('EXAMPLE-NETWORK');
    expect(result.country).toBe('US');
    expect(result.startAddress).toBe('192.0.2.0');
    expect(result.ipVersion).toBe('v4');
    expect(result.organization).toBe('Example Networks Inc.');
    expect(result.notes).toEqual([]);
  });

  it('defaults to IPv6 when ipVersion is absent and the input parses as v6', () => {
    const result = parseRdapNetwork(
      { startAddress: '2001:db8::', endAddress: '2001:db8::ffff:ffff:ffff:ffff' },
      '2001:db8::1',
      'https://rdap.db.ripe.net/'
    );
    expect(result.ipVersion).toBe('v6');
    expect(result.organization).toBeNull();
    expect(result.notes).toContain('The registry did not publish an organization name.');
  });
});
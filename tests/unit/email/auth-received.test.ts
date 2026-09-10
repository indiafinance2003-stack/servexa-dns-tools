import { describe, it, expect } from 'vitest';
import { parseReceivedHeader } from '@/lib/email/received/received-parser';
import { parseAuthenticationResults } from '@/lib/email/authentication/auth-results';
import { analyzeDomainRelationships } from '@/lib/email/analysis/domain-relationships';
import { parseEmailHeaders } from '@/lib/email/parser/email-parser';

describe('Received and authentication parsing', () => {
  it('extracts by/from/with/id and classifies IPs', () => {
    const hop = parseReceivedHeader(
      'from internal (10.0.0.8) by mx.example.net with ESMTPS id x123; Mon, 1 Jan 2024 12:00:00 +0000',
      0
    );
    expect(hop.by).toBe('mx.example.net');
    expect(hop.with).toBe('ESMTPS');
    expect(hop.id).toBe('x123');
    expect(hop.internalIps).toContain('10.0.0.8');
  });

  it('extracts IPv6 literals from Received fields', () => {
    const hop = parseReceivedHeader(
      'from [2001:db8::10] by mx.example.net with ESMTP; Mon, 1 Jan 2024 12:00:00 +0000',
      0
    );
    expect(hop.ipAddresses).toContain('2001:db8::10');
    expect(hop.publicIps).toContain('2001:db8::10');
  });

  it('parses Authentication-Results methods', () => {
    const results = parseAuthenticationResults([
      'mx.example.net; spf=pass smtp.mailfrom=a@example.com; dkim=fail header.d=example.net; dmarc=none',
    ]);
    expect(results.map((r) => r.method)).toEqual(['spf', 'dkim', 'dmarc']);
    expect(results[0].authservId).toBe('mx.example.net');
    expect(results[1].result).toBe('fail');
  });

  it('highlights From vs Return-Path domain differences neutrally', () => {
    const parsed = parseEmailHeaders(`From: user@example.com
Return-Path: <bounce@other.example>
Subject: x`);
    const rel = analyzeDomainRelationships(parsed);
    const mismatch = rel.find((item) => item.label === 'From vs Return-Path');
    expect(mismatch?.severity).toBe('warning');
    expect(mismatch?.note).not.toMatch(/malicious/i);
  });
});

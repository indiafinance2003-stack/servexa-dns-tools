import { describe, it, expect } from 'vitest';
import { parseEmailHeaders } from '@/lib/email/parser/email-parser';
import { analyzeEmailHeaders } from '@/lib/email/analysis/email-analyzer';
import { ParserError, RequestTooLargeError } from '@/lib/errors/app-error';
import { REALISTIC_EMAIL_HEADER } from '../../fixtures/email-headers';
import { config } from '@/lib/config';

describe('Email Header Parser', () => {
  it('parses basic headers', () => {
    const result = parseEmailHeaders(`From: sender@example.com
To: recipient@example.com
Subject: Test Subject
Date: Mon, 1 Jan 2024 12:00:00 +0000`);
    expect(result.from).toBe('sender@example.com');
    expect(result.to).toContain('recipient@example.com');
    expect(result.subject).toBe('Test Subject');
  });

  it('unfolds folded headers', () => {
    const result = parseEmailHeaders(`From: sender@example.com
Subject: This is a very long subject
 that continues on the next line
To: recipient@example.com`);
    expect(result.subject).toContain('This is a very long subject');
    expect(result.subject).toContain('continues on the next line');
  });

  it('keeps repeated headers', () => {
    const result = parseEmailHeaders(`From: sender@example.com
To: recipient1@example.com
To: recipient2@example.com
Subject: Test`);
    expect(result.to).toHaveLength(2);
  });

  it('parses Received hops', () => {
    const result = parseEmailHeaders(`From: sender@example.com
Received: from mail.example.com [192.0.2.1] by receiver.com with ESMTP id abc; Mon, 1 Jan 2024 12:00:00 +0000
Subject: Test`);
    expect(result.receivedHops.length).toBeGreaterThan(0);
    expect(result.receivedHops[0].from).toBe('mail.example.com');
    expect(result.receivedHops[0].by).toBe('receiver.com');
    expect(result.receivedHops[0].publicIps).toContain('192.0.2.1');
  });

  it('parses Authentication-Results', () => {
    const result = parseEmailHeaders(REALISTIC_EMAIL_HEADER);
    expect(result.authenticationResults.some((item) => item.method === 'spf')).toBe(true);
    expect(result.dkimSignatures[0].cryptographicVerification).toBe('not_performed');
  });

  it('rejects empty and oversized input', () => {
    expect(() => parseEmailHeaders('')).toThrow(ParserError);
    expect(() => parseEmailHeaders(null as unknown as string)).toThrow(ParserError);
    expect(() => parseEmailHeaders('x'.repeat(config.MAX_EMAIL_HEADER_BYTES + 1))).toThrow(RequestTooLargeError);
  });

  it('enforces individual header size', () => {
    const chunks = Array.from({ length: 40 }, () => ' ' + 'a'.repeat(400)).join('\n');
    const huge = `From:${chunks}\nSubject: x`;
    const result = parseEmailHeaders(huge);
    expect(result.errors.some((error) => /individual size/.test(error))).toBe(true);
  });

  it('does not claim independent authentication', () => {
    const analysis = analyzeEmailHeaders(REALISTIC_EMAIL_HEADER);
    expect(analysis.authentication.verificationPerformedByThisTool.dkim).toBe('not_performed');
    expect(analysis.observations.some((item) => item.code === 'EMAIL_SCOPE')).toBe(true);
    expect(analysis.domains.length).toBeGreaterThan(0);
  });
});

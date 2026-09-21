import { describe, expect, it } from 'vitest';
import { renderPasswordResetEmail } from '@/lib/email/transactional/templates';

describe('password-reset email template', () => {
  it('uses the exact subject line', () => {
    const content = renderPasswordResetEmail({
      recipientName: 'Ada',
      resetUrl: 'https://ravelyth.in/reset-password?token=abc',
    });
    expect(content.subject).toBe('Reset your Ravelyth password');
  });

  it('HTML-escapes the recipient name', () => {
    const content = renderPasswordResetEmail({
      recipientName: '<script>alert("x")</script>',
      resetUrl: 'https://ravelyth.in/reset-password?token=abc',
    });
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).not.toContain('<script>alert');
  });

  it('HTML-escapes the reset URL inside attributes', () => {
    const url = 'https://ravelyth.in/reset-password?token=abc&next=<b>';
    const content = renderPasswordResetEmail({ recipientName: 'Ada', resetUrl: url });
    expect(content.html).toContain('https://ravelyth.in/reset-password?token=abc&amp;next=&lt;b&gt;');
    expect(content.html).not.toContain('next=<b>');
  });

  it('text version contains the reset URL', () => {
    const resetUrl = 'https://ravelyth.in/reset-password?token=text-token-123';
    const content = renderPasswordResetEmail({ recipientName: 'Ada', resetUrl });
    expect(content.text).toContain(resetUrl);
  });

  it('HTML version contains a reset button/link to the URL', () => {
    const resetUrl = 'https://ravelyth.in/reset-password?token=html-token-123';
    const content = renderPasswordResetEmail({ recipientName: 'Ada', resetUrl });
    expect(content.html).toContain('<a href="https://ravelyth.in/reset-password?token=html-token-123"');
    expect(content.html).toContain('Reset your password');
  });

  it('shows expiration as 30 minutes by default and honors the input', () => {
    const resetUrl = 'https://ravelyth.in/reset-password?token=abc';
    const content = renderPasswordResetEmail({ recipientName: 'Ada', resetUrl });
    expect(content.text).toContain('30 minutes');
    expect(content.html).toContain('30 minutes');
    const custom = renderPasswordResetEmail({
      recipientName: 'Ada',
      resetUrl,
      expiresInMinutes: 30,
    });
    expect(custom.text).toContain('30 minutes');
  });

  it('includes no password or unnecessary account information', () => {
    const content = renderPasswordResetEmail({
      recipientName: 'Ada',
      resetUrl: 'https://ravelyth.in/reset-password?token=abc',
    });
    const combined = `${content.subject}\n${content.text}\n${content.html}`;
    expect(combined).not.toMatch(/password is|your password:/i);
    expect(combined).not.toMatch(/user id|account id|email:/i);
  });
});

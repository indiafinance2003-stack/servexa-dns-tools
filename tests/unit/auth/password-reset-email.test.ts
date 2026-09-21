import { describe, expect, it, vi } from 'vitest';
import {
  describeEmailDeliveryIssue,
  EmailDeliveryUnavailableError,
  sendPasswordResetEmail,
} from '@/lib/email/transactional';

describe('transactional email delivery behavior', () => {
  it('does not fake delivery when no provider is configured', async () => {
    // Test env has no EMAIL_PROVIDER/EMAIL_FROM, so the module must throw a
    // typed unavailable error rather than resolving silently.
    await expect(
      sendPasswordResetEmail({
        to: 'user@example.com',
        recipientName: 'User',
        resetUrl: 'https://ravelyth.in/reset-password?token=abc',
        expiresInMinutes: 30,
      })
    ).rejects.toBeInstanceOf(EmailDeliveryUnavailableError);
  });

  it('unavailable error never carries secrets, tokens, or reset URLs', async () => {
    const error = await sendPasswordResetEmail({
      to: 'user@example.com',
      recipientName: 'User',
      resetUrl: 'https://ravelyth.in/reset-password?token=secret-token-value',
      expiresInMinutes: 30,
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(EmailDeliveryUnavailableError);
    const text = `${(error as Error).message} ${(error as Error).stack ?? ''}`;
    expect(text).not.toContain('secret-token-value');
    expect(text).not.toContain('reset-password?token=');
    expect(text).not.toMatch(/sk-live|api[_-]?key|SMTP password/i);
  });

  it('delivers the correct recipient, URL, expiry, subject, text and HTML via injected provider', async () => {
    const sent: Array<{
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }> = [];
    const provider = {
      name: 'in-memory-test-provider',
      send: vi.fn(async (input: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
      }) => {
        sent.push(input);
      }),
    };
    const resetUrl = 'https://ravelyth.in/reset-password?token=raw-token-123';
    await sendPasswordResetEmail(
      {
        to: 'ada@example.com',
        recipientName: 'Ada',
        resetUrl,
        expiresInMinutes: 30,
      },
      { provider }
    );
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ada@example.com');
    expect(sent[0].subject).toBe('Reset your Ravelyth password');
    expect(sent[0].text).toContain(resetUrl);
    expect(sent[0].text).toContain('30 minutes');
    expect(sent[0].html).toContain('Reset your password');
    expect(sent[0].html).toContain(resetUrl);
  });

  it('provider failures are sanitized before logging (no secrets/tokens/URLs)', () => {
    const secretToken = 'super-secret-raw-token-xyz';
    const failing = new Error(
      `provider boom api_key=sk-live-123 token=${secretToken} https://x/reset-password?token=${secretToken}`
    );
    const reason = describeEmailDeliveryIssue(failing);
    expect(reason).toBe('the transactional email provider reported an error');
    expect(reason).not.toContain(secretToken);
    expect(reason).not.toContain('sk-live-123');
    expect(reason).not.toContain('reset-password?token=');
  });

  it('unavailable errors keep their honest operational message', () => {
    const reason = describeEmailDeliveryIssue(
      new EmailDeliveryUnavailableError('EMAIL_PROVIDER is not configured; no email was sent.')
    );
    expect(reason).toContain('no email was sent');
  });
});

import 'server-only';
import { config } from '@/lib/config';
import { getEmailProvider, emailProviderStatus } from './provider';
import { renderPasswordResetEmail } from './templates';
import type { EmailProvider } from './types';

export { emailProviderStatus };
export type { EmailProviderStatus } from './provider';

/**
 * Transactional email entry point for the password-reset flow.
 *
 * Delivery is provider-neutral and NEVER faked: if EMAIL_PROVIDER is empty,
 * unsupported, or EMAIL_FROM is missing, this throws EmailDeliveryUnavailableError
 * instead of pretending the email was sent. Credentials and the raw reset token
 * are never part of any error or log surfaced from here.
 */

export class EmailDeliveryUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'EmailDeliveryUnavailableError';
  }
}

export interface PasswordResetEmailInput {
  to: string;
  recipientName: string;
  /**
   * Full reset URL (server-generated from APP_URL). Referenced by string only;
   * never logged, never persisted in analytics.
   */
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * Sanitized, credential-free reason for operational logs. Never includes
 * provider secrets, API keys, the recipient, or any part of the reset token.
 */
export function describeEmailDeliveryIssue(error: unknown): string {
  if (error instanceof EmailDeliveryUnavailableError) {
    return error.message;
  }
  return 'the transactional email provider reported an error';
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
  options?: { provider?: EmailProvider }
): Promise<void> {
  // In production the provider always resolves from configuration. The
  // `options.provider` override exists purely so unit tests can exercise the
  // send path with an in-memory adapter — it can never be triggered by request
  // data.
  const provider = options?.provider ?? getEmailProvider();

  if (!provider) {
    const status = emailProviderStatus();
    const reason = status.unsupported
      ? 'EMAIL_PROVIDER is set to an unsupported provider; no email was sent.'
      : 'EMAIL_PROVIDER is not configured; no email was sent.';
    throw new EmailDeliveryUnavailableError(reason);
  }

  const { subject, text, html } = renderPasswordResetEmail({
    recipientName: input.recipientName,
    resetUrl: input.resetUrl,
    expiresInMinutes: input.expiresInMinutes,
  });

  await provider.send({
    // EMAIL_FROM has already been validated by `emailProviderStatus()` and the
    // provider registry — a provider cannot be resolved without it.
    from: config.EMAIL_FROM,
    to: input.to,
    subject,
    text,
    html,
  });
}
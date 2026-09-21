import 'server-only';

/**
 * Password-reset transactional email content (text + HTML).
 *
 * Rules:
 * - Recipient names are user-controlled and are therefore HTML-escaped.
 * - The reset URL is generated server-side from APP_URL, but is still escaped
 *   inside HTML attributes as defense in depth. It must never be logged.
 * - No password, no separately displayed reset token, no sensitive account
 *   information.
 */

const EXPIRES_IN_MINUTES = 30;
const BRAND = 'Ravelyth';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHtmlText(value: string): string {
  return escapeHtml(value);
}

export interface PasswordResetEmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface RenderPasswordResetEmailInput {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(
  input: RenderPasswordResetEmailInput
): PasswordResetEmailContent {
  const name = input.recipientName.length > 0 ? input.recipientName : 'there';
  const expiresInMinutes = input.expiresInMinutes ?? EXPIRES_IN_MINUTES;
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(input.resetUrl);

  const subject = `Reset your ${BRAND} password`;

  const text = [
    `Hi ${name},`,
    '',
    `We received a request to reset the password for your ${BRAND} account.`,
    'Use the link below to choose a new password:',
    '',
    input.resetUrl,
    '',
    `This link will expire in ${expiresInMinutes} minutes.`,
    `If you did not ask to reset your password, you can safely ignore this email — your password will not change.`,
    '',
    `— The ${BRAND} team`,
  ].join('\n');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Helvetica,Arial,sans-serif;">',
    '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">',
    '    <tr>',
    '      <td align="center">',
    '        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">',
    '          <tr>',
    '            <td style="font-size:22px;font-weight:600;color:#0f172a;">Ravelyth</td>',
    '          </tr>',
    '          <tr>',
    '            <td style="height:20px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    `            <td style="font-size:16px;line-height:1.6;color:#334155;">Hi ${safeName},</td>`,
    '          </tr>',
    '          <tr>',
    '            <td style="height:12px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    `            <td style="font-size:15px;line-height:1.6;color:#334155;">We received a request to reset the password for your Ravelyth account. Use the button below to choose a new password.</td>`,
    '          </tr>',
    '          <tr>',
    '            <td style="height:24px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    '            <td align="center">',
    `              <a href="${safeResetUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 24px;border-radius:6px;font-weight:600;text-decoration:none;">Reset your password</a>`,
    '            </td>',
    '          </tr>',
    '          <tr>',
    '            <td style="height:24px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    `            <td style="font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy and paste this link into your browser:</td>`,
    '          </tr>',
    '          <tr>',
    `            <td style="font-size:12px;line-height:1.5;color:#475569;word-break:break-all;">${safeResetUrl}</td>`,
    '          </tr>',
    '          <tr>',
    '            <td style="height:24px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    `            <td style="font-size:14px;line-height:1.6;color:#334155;">This link will expire in ${expiresInMinutes} minutes. If you did not ask to reset your password, you can safely ignore this email — your password will not change.</td>`,
    '          </tr>',
    '          <tr>',
    '            <td style="height:20px;">&nbsp;</td>',
    '          </tr>',
    '          <tr>',
    '            <td style="font-size:13px;color:#94a3b8;">&mdash; The Ravelyth team</td>',
    '          </tr>',
    '        </table>',
    '      </td>',
    '    </tr>',
    '  </table>',
    '</body>',
    '</html>',
  ].join('\n');

  return { subject, text, html };
}
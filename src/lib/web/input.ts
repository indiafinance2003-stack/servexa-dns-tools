import { ValidationError } from '@/lib/errors/app-error';
import { validateServiceUrl } from '@/lib/net/target';

/**
 * Normalizes user-supplied tool input into a validated URL.
 *
 * Users may paste "example.com", "https://example.com/path", or an IP
 * literal. A scheme is never guessed for security: without an explicit scheme
 * the input is treated as https, which is what the tools are for; anything
 * that would produce a non-http(s) URL is rejected by validateServiceUrl.
 */
export function parseWebInput(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError('Enter a website address to check');
  if (trimmed.length > 2048) {
    throw new ValidationError('The address is too long to check');
  }
  if (/[\s<>"'`]/.test(trimmed)) {
    throw new ValidationError('The address contains characters that are not allowed');
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;

  const url = validateServiceUrl(candidate);
  if (!url.hostname) throw new ValidationError('Enter a valid website address');
  return url;
}

/** Truncates a decoded body to a safe single-line-ish preview for display. */
export function buildBodyPreview(body: string | null, maxChars = 400): string | null {
  if (!body) return null;
  const collapsed = body.slice(0, maxChars * 4).replace(/\s+/g, ' ').trim();
  return collapsed ? collapsed.slice(0, maxChars) : null;
}

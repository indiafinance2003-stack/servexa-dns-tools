import { NextRequest } from 'next/server';
import { handleApi, enforceRequestGuards, readJsonBody } from '@/lib/errors/api-handler';
import {
  checkRateLimit,
  createRateLimiter,
  type RateLimiter,
} from '@/lib/security/rate-limit/rate-limiter';
import { config } from '@/lib/config';
import { sha256Hex } from '@/lib/billing/providers/razorpay';
import { submitContact } from '@/lib/contact/service';

/**
 * Public contact endpoint.
 *
 * Unauthenticated by design, so it carries its own abuse controls on top of the
 * shared endpoint limiter:
 *   - a dedicated limiter (3 submissions / minute / client),
 *   - a hidden honeypot field that bots fill and humans never see — honeypot
 *     hits are acknowledged but NOT persisted,
 *   - input bounds enforced in the service,
 *   - only a SHA-256 fingerprint of the client IP is stored.
 */

const contactLimiter: RateLimiter = createRateLimiter(60_000, 3);

function clientIp(req: NextRequest): string {
  if (config.TRUST_PROXY_HEADERS) {
    const forwarded = req.headers.get('x-forwarded-for');
    const forwardedIp = forwarded?.split(',')[0]?.trim();
    if (forwardedIp) return forwardedIp.slice(0, 128);
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.slice(0, 128);
  }
  // The IP is only considered a client identifier when a trusted reverse proxy
  // set it. Otherwise every submission shares a single rate-limit bucket and a
  // non-PII fingerprint, so spoofed headers cannot bypass the limiter or be
  // stored as if they were real addresses.
  return 'untrusted';
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    enforceRequestGuards(req);
    checkRateLimit(contactLimiter, clientIp(req));

    const body = await readJsonBody(req);

    // Honeypot: real users never see this field, so a filled value means a bot.
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return { received: true, honeypot: true };
    }

    const submission = await submitContact({
      name: body.name,
      email: body.email,
      subject: body.subject,
      message: body.message,
      ipFingerprint: sha256Hex(clientIp(req)),
    });

    return { received: true, id: submission.id };
  }, () => 202);
}
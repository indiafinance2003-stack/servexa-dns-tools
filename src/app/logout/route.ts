import { NextRequest, NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

/**
 * Sign-out endpoint. This is a POST-only route handler, not a content page:
 * GET requests are rejected so that a plain link or prefetch can never log
 * someone out, and cross-site POSTs do not carry the session cookie
 * (SameSite=Lax). The database session is invalidated before the redirect.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    await destroySession();
  } catch {
    // Fall through: the cookie is cleared below regardless, and any orphaned
    // session row will be removed by expiration cleanup.
  }

  const response = NextResponse.redirect(new URL('/login', req.nextUrl.origin), {
    status: 303,
  });
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
  return response;
}

export function GET(): Response {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Sign out requires a POST request.' },
    },
    { status: 405 }
  );
}

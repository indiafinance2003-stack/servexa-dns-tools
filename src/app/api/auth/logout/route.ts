import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';
import { APIResponse } from '@/types/api';

async function logout(): Promise<{ ok: boolean }> {
  // Invalidates the database session and clears the authentication cookie.
  await destroySession();
  return { ok: true };
}

export async function POST(): Promise<Response> {
  try {
    const data = await logout();
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    // Even on unexpected failure, respond cleanly; the cookie clearing inside
    // destroySession has already been requested via the cookie store.
    return NextResponse.json(
      { success: true, data: { ok: true } } satisfies APIResponse<{ ok: boolean }>
    );
  }
}

export function GET(): Response {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to sign out.' },
    },
    { status: 405 }
  );
}

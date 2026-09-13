import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { APIResponse } from '@/types/api';

/**
 * Returns the current authenticated user from the server-side session, or
 * null for anonymous visitors. Identity is derived exclusively from the
 * HttpOnly session cookie; nothing here trusts client input.
 */
export async function GET(): Promise<Response> {
  try {
    const user = await getSessionUser();
    return NextResponse.json({
      success: true,
      data: {
        user: user
          ? { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
          : null,
      },
    } satisfies APIResponse<{ user: unknown }>);
  } catch {
    return NextResponse.json({
      success: true,
      data: { user: null },
    } satisfies APIResponse<{ user: unknown }>);
  }
}

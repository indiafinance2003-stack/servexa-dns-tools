import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { parseWithSchema } from '@/lib/validation/parse';
import { registrationSchema } from '@/lib/auth/schemas';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { promoteOwnerIfConfigured } from '@/lib/auth/owner-bootstrap';
import {
  getRegisterRateLimiter,
  registerKey,
  checkAuthRateLimit,
} from '@/lib/auth/rate-limit';
import { requireDatabase } from '@/lib/db/require-database';
import { users } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';

function duplicateEmailError(): AppError {
  return new AppError(
    AppErrorCode.EMAIL_TAKEN,
    'An account with this email already exists. Try signing in instead.',
    409
  );
}

async function register(req: NextRequest) {
  checkAuthRateLimit(getRegisterRateLimiter(), registerKey(req), 'Too many registration attempts. Please try again later.');

  const body = await readJsonBody(req);
  const input = parseWithSchema(registrationSchema, body);
  const passwordHash = await hashPassword(input.password);

  const { db } = requireDatabase();

  let created: { id: string; email: string; name: string };
  try {
    const inserted = await db
      .insert(users)
      .values({ email: input.email, passwordHash, name: input.name })
      .returning({ id: users.id, email: users.email, name: users.name });
    created = inserted[0];
  } catch (error) {
    // Unique-constraint violation (Postgres 23505): the email was registered
    // concurrently between the pre-check and this insert.
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw duplicateEmailError();
    }
    throw error;
  }

  // If OWNER_EMAIL equals the just-created account, the account is immediately
  // promoted to owner (matching how logins re-assert the bootstrap role).
  await promoteOwnerIfConfigured(created.id, created.email);

  await createSession(created.id);
  logger.info('User registered', { userId: created.id });

  return { user: created };
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, () => register(req), () => 201);
}

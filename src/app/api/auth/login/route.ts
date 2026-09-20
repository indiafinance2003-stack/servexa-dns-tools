import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { parseWithSchema } from '@/lib/validation/parse';
import { loginSchema } from '@/lib/auth/schemas';
import { getDummyPasswordHash, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { promoteOwnerIfConfigured } from '@/lib/auth/owner-bootstrap';
import {
  checkAuthRateLimit,
  getLoginRateLimiter,
  loginKey,
  LOGIN_WINDOW_MS,
} from '@/lib/auth/rate-limit';
import { requireDatabase } from '@/lib/db/require-database';
import { users } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';

const GENERIC_CREDENTIALS_ERROR = () =>
  new AppError(
    AppErrorCode.AUTH_INVALID_CREDENTIALS,
    'Invalid email or password.',
    401
  );

async function login(req: NextRequest) {
  const body = await readJsonBody(req);
  const input = parseWithSchema(loginSchema, body);

  // Keyed by request identity AND the submitted (normalized) email so a
  // single account cannot be brute forced even if the IP is spoofed.
  checkAuthRateLimit(
    getLoginRateLimiter(),
    loginKey(req, input.email),
    `Too many login attempts. Try again in ${Math.ceil(LOGIN_WINDOW_MS / 60000)} minutes.`
  );

  const { db } = requireDatabase();

  const found = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = found[0];
  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(await getDummyPasswordHash(), input.password);

  if (!user || !passwordMatches) {
    // Generic message: do not reveal whether the email exists.
    throw GENERIC_CREDENTIALS_ERROR();
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // The OWNER_EMAIL account becomes the owner on any successful sign-in.
  // Bootstrap is server-only and never client-settable.
  await promoteOwnerIfConfigured(user.id, user.email);

  await createSession(user.id);
  logger.info('User logged in', { userId: user.id });

  return { user: { id: user.id, email: user.email, name: user.name } };
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, () => login(req));
}

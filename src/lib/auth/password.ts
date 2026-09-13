import 'server-only';
import { randomBytes } from 'crypto';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

/**
 * Argon2id parameters (OWASP-recommended baseline for interactive logins):
 * 19 MiB memory, 2 iterations, 1 degree of parallelism.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Password policy: a usable minimum length with an upper bound to prevent
 * abuse. Complexity rules are intentionally not imposed (NIST SP 800-63B).
 * Passwords are never trimmed or silently altered.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password must be at most 200 characters')
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: 'Password contains invalid control characters',
  });

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    // A malformed stored hash must never leak details or throw to callers.
    return false;
  }
}

/**
 * Used to equalize timing when the submitted email does not exist, so that
 * login responses do not reveal whether an account exists.
 */
let dummyHashPromise: Promise<string> | undefined;

export async function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    // Hash of an unrelated random string, computed once per process. This
    // value never matches any real verification outcome.
    dummyHashPromise = hash(
      'ravelyth-timing-equalizer-' + randomBytes(16).toString('base64url'),
      ARGON2_OPTIONS
    );
  }
  return dummyHashPromise;
}

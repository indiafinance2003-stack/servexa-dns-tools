import { z } from 'zod';
import { passwordSchema } from './password';

/** Emails are normalized once, consistently, for every lookup. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .min(3, 'Email is required')
  .max(254, 'Email is too long')
  .transform(normalizeEmail)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: 'Enter a valid email address',
  });

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'Name must be at most 80 characters');

export const registrationSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

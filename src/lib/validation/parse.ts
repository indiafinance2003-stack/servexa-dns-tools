import { ZodError, ZodType } from 'zod';
import { ValidationError } from '@/lib/errors/app-error';

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.errors.map((item) => item.message).join(', '), {
        issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    throw error;
  }
}

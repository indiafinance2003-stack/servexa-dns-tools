import { ZodError, type ZodTypeAny, type z } from 'zod';
import { ValidationError } from '@/lib/errors/app-error';

/**
 * Validates `input` against `schema` and returns the schema's OUTPUT type.
 *
 * The schema is captured as a generic (`S extends ZodTypeAny`) rather than as
 * `ZodType<T>`, because for schemas that carry `.default()`, `.transform()` or
 * `.refine()` the input type differs from the output type. Inferring through
 * `z.infer<S>` keeps callers on the parsed (post-transform) shape instead of
 * accidentally widening to the pre-validation input shape.
 */
export function parseWithSchema<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
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

import { RequestHandler } from 'express';
import { AnyZodObject, ZodEffects } from 'zod';
import { ApiError } from '../utils/ApiError';

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * Validate req.body (and optionally params/query) against a Zod schema.
 * Usage: router.post('/', validate(createPlayerSchema), controller)
 */
export const validate =
  (schema: Schema, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      // Replace with the parsed (coerced/trimmed) value.
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      next(err); // ZodError → handled by errorHandler
    }
  };

export { ApiError };

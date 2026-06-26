import { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/** Centralised error handler. Emits a consistent JSON envelope + correct status codes. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Zod validation errors → 400
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten().fieldErrors,
    });
  }

  // 2. Mongoose duplicate-key → 409
  if (err instanceof mongoose.Error && (err as any).code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate value for a unique field',
      fields: (err as any).keyValue,
    });
  }

  // 3. Mongoose cast / validation → 400
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
  }

  // 4. Known operational errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }

  // 5. Unknown — log full detail, return generic message
  logger.error(`${req.method} ${req.originalUrl} → unhandled error`, {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

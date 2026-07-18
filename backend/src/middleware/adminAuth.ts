import { type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

/**
 * Admin credentials loaded from environment variables.
 * Configured in backend/.env — never committed to source control.
 */
const ADMIN_USERNAME = env.ADMIN_USERNAME;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

/** Secret for admin JWT tokens — separate from user JWT for isolation. */
const ADMIN_JWT_SECRET = env.ADMIN_JWT_SECRET;
const ADMIN_JWT_TTL = '24h';

export interface AdminPayload {
  username: string;
  role: 'admin';
}

/** Sign an admin JWT token. */
export function signAdminToken(username: string): string {
  return jwt.sign(
    { username, role: 'admin' },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_JWT_TTL as jwt.SignOptions['expiresIn'] }
  );
}

/** Verify an admin JWT token. */
export function verifyAdminToken(token: string): AdminPayload {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired admin token');
  }
}

/**
 * Validate admin credentials.
 * Returns true if credentials match, false otherwise.
 * Replace this function with a database lookup when ready.
 */
export function validateAdminCredentials(identifier: string, password: string): boolean {
  return identifier === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

/**
 * Require a valid admin JWT token in the Authorization header.
 * Attaches the decoded admin payload to req.admin.
 */
export const requireAdminAuth: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Admin authentication required'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAdminToken(token);
    (req as any).admin = payload;
    next();
  } catch (err) {
    next(err);
  }
};

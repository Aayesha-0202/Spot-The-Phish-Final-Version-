import { type RequestHandler } from 'express';
import { ACCESS_COOKIE, verifyAccessToken } from '../services/tokenService';
import { isDbConnected } from '../config/db';
import { ApiError } from '../utils/ApiError';

/**
 * Require a valid access-token cookie. Attaches the decoded user to req.user.
 * Does NOT silently refresh — the client calls /api/auth/refresh on 401.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!isDbConnected()) return next(ApiError.serviceUnavailable('Database unavailable'));
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(ApiError.unauthorized('Authentication required'));

  try {
    const payload = verifyAccessToken(token);
    req.user = { _id: payload.sub, email: payload.email, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Parse the access token if present, but never reject. req.user is set or null.
 * Used by game/session/report/email endpoints so guests can still play.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { _id: payload.sub, email: payload.email, username: payload.username };
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

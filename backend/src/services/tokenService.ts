import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { type Response, type CookieOptions } from 'express';
import { env } from '../config/env';
import { RefreshToken } from '../models';
import type { IUser, AuthUser } from '../types';
import { ApiError } from '../utils/ApiError';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  username: string;
}
export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
}

/** Parse "15m" / "2h" / "30s" / "60000" → milliseconds. */
function ttlToMs(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return n * 60 * 1000; // 'm' or bare number → minutes
  }
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function baseCookieOptions(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  };
  if (env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN;
  return opts;
}

function accessCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), path: '/', maxAge: ttlToMs(env.JWT_ACCESS_TTL) };
}

function refreshCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions(),
    path: '/api/auth', // scoped — refresh cookie only sent to auth endpoints (CSRF hardening)
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

/** Env-driven TTL → SignOptions (jsonwebtoken brands expiresIn, so cast). */
function ttlOptions(ttl: string): SignOptions {
  return { expiresIn: ttl as unknown as SignOptions['expiresIn'] };
}

export function signAccessToken(user: IUser | AuthUser): string {
  return jwt.sign(
    { sub: String(user._id), email: user.email, username: user.username },
    env.JWT_ACCESS_SECRET,
    ttlOptions(env.JWT_ACCESS_TTL)
  );
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, ttlOptions(`${env.JWT_REFRESH_TTL_DAYS}d`));
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: '/api/auth' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

export function decodeRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
}

/**
 * Mint a fresh token pair, persisting the (hashed) refresh token. Returns the
 * public user shape for the response body.
 */
export async function issueTokens(res: Response, user: IUser): Promise<AuthUser> {
  const userId = String(user._id);
  const jti = uuidv4();
  const refreshToken = signRefreshToken(userId, jti);
  const accessToken = signAccessToken(user);

  await RefreshToken.create({
    tokenHash: hashToken(refreshToken),
    user: user._id,
    jti,
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    revoked: false,
  });

  setAuthCookies(res, accessToken, refreshToken);
  return { _id: userId, email: user.email, username: user.username };
}

/**
 * Rotate a refresh token: verify, look it up, revoke it, and issue a new pair.
 * Reuse detection — if the presented token was already revoked, the whole chain
 * is revoked and the caller must re-authenticate.
 */
export async function rotateRefreshToken(res: Response, rawRefresh: string): Promise<AuthUser> {
  const payload = decodeRefreshToken(rawRefresh);
  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored) throw ApiError.unauthorized('Refresh token not recognised');

  // Reuse detected: a previously-rotated (revoked) token was presented again.
  // Revoke the entire chain for this user to protect the account.
  if (stored.revoked) {
    await RefreshToken.updateMany({ user: stored.user, revoked: false }, { $set: { revoked: true } });
    throw ApiError.unauthorized('Refresh token reuse detected — please sign in again');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    stored.revoked = true;
    await stored.save();
    throw ApiError.unauthorized('Refresh token expired');
  }

  const user = await import('../models').then((m) => m.User.findById(stored.user));
  if (!user) throw ApiError.unauthorized('User no longer exists');

  // Revoke the old token, link to its successor.
  const newJti = uuidv4();
  stored.revoked = true;
  stored.replacedBy = newJti;
  await stored.save();

  const newRefresh = signRefreshToken(String(user._id), newJti);
  await RefreshToken.create({
    tokenHash: hashToken(newRefresh),
    user: user._id,
    jti: newJti,
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    revoked: false,
  });

  setAuthCookies(res, signAccessToken(user), newRefresh);
  return { _id: String(user._id), email: user.email, username: user.username };
}

/** Revoke every active refresh token for a user (logout, password change). */
export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revoked: false }, { $set: { revoked: true } });
}

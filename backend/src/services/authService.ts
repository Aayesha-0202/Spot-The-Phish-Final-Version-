import { type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, PasswordReset, RefreshToken } from '../models';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  issueTokens,
  revokeAllForUser,
  hashToken,
  rotateRefreshToken,
  decodeRefreshToken,
  clearAuthCookies,
} from './tokenService';
import { getMailer, getFromAddress } from '../config/mailer';
import type { AuthUser, IUser } from '../types';

const BCRYPT_ROUNDS = 12;

function toPublicUser(user: IUser): AuthUser {
  return { _id: String(user._id), email: user.email, username: user.username };
}

export async function register(res: Response, username: string, email: string, password: string): Promise<AuthUser> {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ username, email, passwordHash, emailVerified: false });
  return issueTokens(res, user);
}

export async function login(res: Response, email: string, password: string): Promise<AuthUser> {
  const user = await User.findOne({ email });
  // Constant-ish path + generic message to avoid user enumeration.
  const invalid = () => ApiError.unauthorized('Invalid email or password');
  if (!user || !user.passwordHash) throw invalid();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid();

  user.lastLoginAt = new Date();
  await user.save();
  return issueTokens(res, user);
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) throw ApiError.serviceUnavailable('Google login is not configured (GOOGLE_CLIENT_ID missing)');
  if (!googleClient) googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return googleClient;
}

export async function googleLogin(res: Response, credential: string): Promise<AuthUser> {
  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw ApiError.unauthorized('Invalid Google credential');
  if (payload.email_verified === false) throw ApiError.unauthorized('Google email is not verified');

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const username = (payload.name || email.split('@')[0]).slice(0, 40);

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  if (!user) {
    user = await User.create({
      username,
      email,
      googleId,
      emailVerified: true,
      profile: { avatarUrl: payload.picture || undefined },
    });
  } else {
    // Link googleId if this is the first Google sign-in for an existing email account.
    let dirty = false;
    if (!user.googleId) { user.googleId = googleId; dirty = true; }
    if (!user.emailVerified) { user.emailVerified = true; dirty = true; }
    if (dirty) await user.save();
  }

  user.lastLoginAt = new Date();
  await user.save();
  return issueTokens(res, user);
}

export async function refreshSession(res: Response, rawRefresh: string): Promise<AuthUser> {
  return rotateRefreshToken(res, rawRefresh);
}

export async function logout(res: Response, rawRefresh?: string): Promise<void> {
  if (rawRefresh) {
    try {
      const payload = decodeRefreshToken(rawRefresh);
      await RefreshToken.updateOne({ jti: payload.jti }, { $set: { revoked: true } });
    } catch {
      // expired/invalid refresh — nothing to revoke
    }
  }
  clearAuthCookies(res);
}

export async function me(userId: string): Promise<AuthUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always resolve — never reveal whether the email exists.
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  await PasswordReset.deleteMany({ user: user._id }); // invalidate prior tokens
  await PasswordReset.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    used: false,
  });

  const resetUrl = `${env.CLIENT_ORIGIN}/auth/reset-password?token=${rawToken}`;

  if (env.PRINT_RESET_LINKS || !env.SMTP_HOST) {
    logger.info(`🔑 Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await getMailer().sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Reset your Spot the Phish password',
    html: `<p>Hello,</p><p>Reset your password by visiting:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const reset = await PasswordReset.findOne({ tokenHash });
  if (!reset || reset.used || reset.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('Reset token is invalid or has expired');
  }
  const user = await User.findById(reset.user);
  if (!user) throw ApiError.notFound('User not found');

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  reset.used = true;
  await reset.save();
  await revokeAllForUser(String(user._id)); // force re-login everywhere
}

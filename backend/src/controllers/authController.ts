import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { REFRESH_COOKIE } from '../services/tokenService';

/** POST /api/auth/register */
export const register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { username, email, password } = req.body;
  const user = await authService.register(res, username, email, password);
  return sendCreated(res, { user }, 'Account created');
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, password } = req.body;
  const user = await authService.login(res, email, password);
  return sendSuccess(res, { user }, 'Logged in');
});

/** POST /api/auth/google */
export const google = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const user = await authService.googleLogin(res, req.body.credential);
  return sendSuccess(res, { user }, 'Logged in with Google');
});

/** POST /api/auth/refresh */
export const refresh = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const rawRefresh = req.cookies?.[REFRESH_COOKIE];
  const user = await authService.refreshSession(res, rawRefresh);
  return sendSuccess(res, { user }, 'Token refreshed');
});

/** POST /api/auth/logout */
export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await authService.logout(res, req.cookies?.[REFRESH_COOKIE]);
  return sendSuccess(res, null, 'Logged out');
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const user = await authService.me(req.user!._id);
  return sendSuccess(res, { user }, 'Current user');
});

/** POST /api/auth/forgot-password */
export const forgotPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await authService.forgotPassword(req.body.email);
  // Always 200 — never reveal whether the email exists.
  return sendSuccess(res, null, 'If that email exists, a reset link has been sent');
});

/** POST /api/auth/reset-password */
export const resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return sendSuccess(res, null, 'Password reset — please log in');
});

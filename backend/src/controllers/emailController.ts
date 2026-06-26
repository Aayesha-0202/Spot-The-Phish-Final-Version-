import { Request, Response, NextFunction } from 'express';
import { sendReportEmail } from '../services/emailService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { isDbConnected } from '../config/db';

/** POST /api/sessions/:sessionId/email-report — auto-email the finished report. */
export const emailReport = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  if (!isDbConnected()) throw ApiError.serviceUnavailable('Database unavailable — cannot send report');
  const { pngBase64, ...fields } = req.body;
  const result = await sendReportEmail(req.params.sessionId, fields, pngBase64);
  return sendSuccess(res, result, 'Report emailed');
});

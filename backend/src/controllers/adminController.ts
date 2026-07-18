import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/adminService';
import { signAdminToken, validateAdminCredentials } from '../middleware/adminAuth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

/** POST /api/admin/login */
export const adminLogin = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw ApiError.badRequest('Username and password are required');
  }

  const valid = validateAdminCredentials(username, password);
  if (!valid) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  const token = signAdminToken(username);
  return sendSuccess(res, { token, username, role: 'admin' }, 'Admin login successful');
});

/** GET /api/admin/overview */
export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getDashboardOverview();
  return sendSuccess(res, data);
});

/** GET /api/admin/players */
export const getPlayers = asyncHandler(async (req: Request, res: Response) => {
  const { search, page, limit } = req.query;
  const data = await adminService.getPlayers({
    search: search as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return sendSuccess(res, data);
});

/** GET /api/admin/players/:playerId */
export const getPlayerProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getPlayerProfile(req.params.playerId);
  return sendSuccess(res, data);
});

/** GET /api/admin/stimuli */
export const getStimuli = asyncHandler(async (req: Request, res: Response) => {
  const { search, tier, category, status, truthClass, page, limit } = req.query;
  const data = await adminService.getStimuli({
    search: search as string,
    tier: tier ? Number(tier) : undefined,
    category: category as string,
    status: status as string,
    truthClass: truthClass as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return sendSuccess(res, data);
});

/** PATCH /api/admin/stimuli/:stimulusId/status */
export const updateStimulusStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'draft', 'retired'].includes(status)) {
    throw ApiError.badRequest('Status must be active, draft, or retired');
  }
  const data = await adminService.updateStimulusStatus(req.params.stimulusId, status);
  return sendSuccess(res, data, 'Stimulus status updated');
});

/** POST /api/admin/stimuli/bulk-status */
export const bulkUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { stimulusIds, status } = req.body;
  if (!Array.isArray(stimulusIds) || !['active', 'draft', 'retired'].includes(status)) {
    throw ApiError.badRequest('stimulusIds array and valid status required');
  }
  const data = await adminService.bulkUpdateStimulusStatus(stimulusIds, status);
  return sendSuccess(res, data, 'Bulk update completed');
});

/** POST /api/admin/stimuli/all-status */
export const setAllStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'draft', 'retired'].includes(status)) {
    throw ApiError.badRequest('Status must be active, draft, or retired');
  }
  const data = await adminService.setAllStimulusStatus(status);
  return sendSuccess(res, data, 'All stimuli status updated');
});

/** GET /api/admin/analytics/games */
export const getGameAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getGameAnalytics();
  return sendSuccess(res, data);
});

/** GET /api/admin/analytics/stimuli */
export const getStimulusAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getStimulusAnalytics();
  return sendSuccess(res, data);
});

/** GET /api/admin/activity */
export const getActivity = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const data = await adminService.getPlayerActivity(limit);
  return sendSuccess(res, data);
});

/** GET /api/admin/leaderboard */
export const getLeaderboard = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getAdminLeaderboard();
  return sendSuccess(res, data);
});

/** GET /api/admin/health */
export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getSystemHealth();
  return sendSuccess(res, data);
});

/** GET /api/admin/learning-insights */
export const getLearningInsights = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminService.getLearningInsights();
  return sendSuccess(res, data);
});

// ---------------------------------------------------------------------------
// Full Stimulus CRUD (content editing)
// ---------------------------------------------------------------------------

import { Stimulus } from '../models/Stimulus';

/** GET /api/admin/stimuli/full — all stimuli with full content for admin view */
export const getFullStimuli = asyncHandler(async (req: Request, res: Response) => {
  const { tier, type, status, truthClass } = req.query;
  const filter: Record<string, unknown> = {};
  if (tier) filter.tier = Number(tier);
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (truthClass) filter.truthClass = truthClass;
  const stimuli = await Stimulus.find(filter).sort({ tier: 1, stimulusId: 1 }).lean();
  return sendSuccess(res, { stimuli, total: stimuli.length });
});

/** GET /api/admin/stimuli/full/:stimulusId — single stimulus with full content */
export const getFullStimulus = asyncHandler(async (req: Request, res: Response) => {
  const stimulus = await Stimulus.findOne({ stimulusId: req.params.stimulusId }).lean();
  if (!stimulus) throw ApiError.notFound('Stimulus not found');
  return sendSuccess(res, stimulus);
});

/** PUT /api/admin/stimuli/full/:stimulusId — update stimulus content */
export const updateFullStimulus = asyncHandler(async (req: Request, res: Response) => {
  const { sender, content, actionUrl, actionText, amount, explanation, type, category, tier, truthClass, status } = req.body;
  const update: Record<string, unknown> = {};
  if (sender !== undefined) update.sender = sender;
  if (content !== undefined) update.content = content;
  if (actionUrl !== undefined) update.actionUrl = actionUrl;
  if (actionText !== undefined) update.actionText = actionText;
  if (amount !== undefined) update.amount = amount;
  if (explanation !== undefined) update.explanation = explanation;
  if (type !== undefined) update.type = type;
  if (category !== undefined) update.category = category;
  if (tier !== undefined) update.tier = tier;
  if (truthClass !== undefined) update.truthClass = truthClass;
  if (status !== undefined) update.status = status;

  const stimulus = await Stimulus.findOneAndUpdate(
    { stimulusId: req.params.stimulusId },
    { $set: update },
    { new: true }
  );
  if (!stimulus) throw ApiError.notFound('Stimulus not found');
  return sendSuccess(res, stimulus, 'Stimulus updated');
});

// ---------------------------------------------------------------------------
// CSV Exports
// ---------------------------------------------------------------------------

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','));
  }
  return lines.join('\n');
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}

/** GET /api/admin/export/leaderboard */
export const exportLeaderboard = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await adminService.exportLeaderboardCSV();
  return sendCsv(res, 'leaderboard.csv', toCsv(rows));
});

/** GET /api/admin/export/player-analytics */
export const exportPlayerAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await adminService.exportPlayerAnalyticsCSV();
  return sendCsv(res, 'player-analytics.csv', toCsv(rows));
});

/** GET /api/admin/export/stimulus-analytics */
export const exportStimulusAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await adminService.exportStimulusAnalyticsCSV();
  return sendCsv(res, 'stimulus-analytics.csv', toCsv(rows));
});

/** GET /api/admin/export/gameplay-analytics */
export const exportGameplayAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await adminService.exportGameplayAnalyticsCSV();
  return sendCsv(res, 'gameplay-analytics.csv', toCsv(rows));
});

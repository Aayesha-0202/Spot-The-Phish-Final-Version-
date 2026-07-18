/**
 * Gameplay Controller — API handlers for the stimulus rotation system.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import * as gameplayService from '../services/gameplayService';

/**
 * POST /api/gameplay/generate
 * Generate a new gameplay session with balanced, unseen stimuli for a player.
 */
export const generateSession = asyncHandler(async (req: Request, res: Response) => {
  const { playerId } = req.body;

  if (!playerId || typeof playerId !== 'string') {
    throw ApiError.badRequest('playerId is required');
  }

  const result = await gameplayService.generateGameplaySession(playerId);

  sendSuccess(res, result, 'Gameplay session generated');
});

/**
 * GET /api/gameplay/history/:playerId
 * Get a player's stimulus history and analytics.
 */
export const getPlayerHistory = asyncHandler(async (req: Request, res: Response) => {
  const { playerId } = req.params;

  const history = await gameplayService.getPlayerAnalytics(playerId);
  sendSuccess(res, history, 'Player history retrieved');
});

/**
 * GET /api/gameplay/admin/players
 * Get analytics for all players (admin dashboard).
 */
export const getAllPlayers = asyncHandler(async (_req: Request, res: Response) => {
  const players = await gameplayService.getAllPlayersAnalytics();
  sendSuccess(res, players, 'All player analytics retrieved');
});

/**
 * DELETE /api/gameplay/history/:playerId
 * Reset a player's stimulus history (admin action).
 */
export const resetPlayerHistory = asyncHandler(async (req: Request, res: Response) => {
  const { playerId } = req.params;
  const { PlayerStimulusHistory } = await import('../models/PlayerStimulusHistory');

  const result = await PlayerStimulusHistory.findOneAndDelete({ playerId });
  if (!result) {
    throw ApiError.notFound('Player history not found');
  }

  sendSuccess(res, { playerId }, 'Player history reset');
});

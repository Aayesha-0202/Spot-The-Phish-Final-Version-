import { Router } from 'express';
import playerRoutes from './playerRoutes';
import sessionRoutes from './sessionRoutes';
import resultRoutes from './resultRoutes';
import analyticsRoutes from './analyticsRoutes';
import authRoutes from './authRoutes';
import leaderboardRoutes from './leaderboardRoutes';
import gameplayRoutes from './gameplayRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/players', playerRoutes);
router.use('/sessions', sessionRoutes);
router.use('/sessions', resultRoutes); // /sessions/:sessionId/report(/download) + /email-report
router.use('/analytics', analyticsRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/gameplay', gameplayRoutes);
router.use('/admin', adminRoutes);

export default router;

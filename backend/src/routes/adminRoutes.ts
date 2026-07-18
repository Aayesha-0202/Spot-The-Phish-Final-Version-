import { Router } from 'express';
import * as adminCtrl from '../controllers/adminController';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

// Public: admin login
router.post('/login', adminCtrl.adminLogin);

// All routes below require admin auth
router.use(requireAdminAuth);

// Dashboard overview
router.get('/overview', adminCtrl.getOverview);

// Players
router.get('/players', adminCtrl.getPlayers);
router.get('/players/:playerId', adminCtrl.getPlayerProfile);

// Stimuli
router.get('/stimuli', adminCtrl.getStimuli);
router.get('/stimuli/full', adminCtrl.getFullStimuli);
router.get('/stimuli/full/:stimulusId', adminCtrl.getFullStimulus);
router.put('/stimuli/full/:stimulusId', adminCtrl.updateFullStimulus);
router.patch('/stimuli/:stimulusId/status', adminCtrl.updateStimulusStatus);
router.post('/stimuli/bulk-status', adminCtrl.bulkUpdateStatus);
router.post('/stimuli/all-status', adminCtrl.setAllStatus);

// Analytics
router.get('/analytics/games', adminCtrl.getGameAnalytics);
router.get('/analytics/stimuli', adminCtrl.getStimulusAnalytics);

// Activity
router.get('/activity', adminCtrl.getActivity);

// Leaderboard
router.get('/leaderboard', adminCtrl.getLeaderboard);

// System health
router.get('/health', adminCtrl.getHealth);

// Learning insights
router.get('/learning-insights', adminCtrl.getLearningInsights);

// Exports
router.get('/export/leaderboard', adminCtrl.exportLeaderboard);
router.get('/export/player-analytics', adminCtrl.exportPlayerAnalytics);
router.get('/export/stimulus-analytics', adminCtrl.exportStimulusAnalytics);
router.get('/export/gameplay-analytics', adminCtrl.exportGameplayAnalytics);

export default router;

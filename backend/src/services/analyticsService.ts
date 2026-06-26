import { Analytics } from '../models/Analytics';
import { GameSession } from '../models/GameSession';
import { StimulusAttempt } from '../models/StimulusAttempt';
import { Player } from '../models/Player';
import { ApiError } from '../utils/ApiError';
import { z } from 'zod';
import { reportSchema } from '../schemas';

type ReportInput = z.infer<typeof reportSchema>;

async function requireSession(sessionId: string) {
  const session = await GameSession.findOne({ sessionId });
  if (!session) throw ApiError.notFound('Session not found');
  return session;
}

/** Save (upsert) the final report + analytics for a session. */
export async function saveReport(sessionId: string, report: ReportInput) {
  const session = await requireSession(sessionId);
  const analytics = await Analytics.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        ...report,
        session: session._id,
        player: session.player,
        playerId: session.playerId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (report.reportSummary) {
    session.reportSummary = report.reportSummary;
    session.designation = report.designation ?? session.designation;
    session.readinessLevel = report.readinessLevel ?? session.readinessLevel;
    session.totalScore = report.compositeScore ?? session.totalScore;
    await session.save();
  }
  return analytics;
}

export async function getReport(sessionId: string) {
  const session = await requireSession(sessionId);
  const analytics = await Analytics.findOne({ sessionId }).lean();
  return { session, analytics };
}

/** Everything the downloadable share card needs, in one payload. */
export async function getDownloadMetadata(sessionId: string) {
  const { session, analytics } = await getReport(sessionId);
  const player = await Player.findById(session.player).lean();
  return {
    playerName: player?.name ?? 'ANONYMOUS',
    sessionId: session.sessionId,
    compositeScore: analytics?.compositeScore ?? session.totalScore,
    designation: analytics?.designation ?? session.designation,
    readinessLevel: analytics?.readinessLevel ?? session.readinessLevel,
    strongestCategory: analytics?.strongestCategory,
    weakestCategory: analytics?.weakestCategory,
    categoryAccuracy: analytics?.categoryAccuracy,
    tierAccuracy: analytics?.tierAccuracy,
    phishingDetectionRate: analytics?.phishingDetectionRate,
    falseAlarmRate: analytics?.falseAlarmRate,
    reportSummary: analytics?.reportSummary ?? session.reportSummary,
    completedLevels: session.completedLevels,
    livesRemaining: session.livesRemaining,
    streakAchieved: session.streakAchieved,
    generatedAt: new Date().toISOString(),
  };
}

/** Cross-session rollup. */
export async function overallAnalytics() {
  const [totals] = await Promise.all([
    (async () => ({
      players: await Player.countDocuments(),
      sessions: await GameSession.countDocuments(),
      completed: await GameSession.countDocuments({ status: 'completed' }),
    }))(),
  ]);

  const [scoreAgg] = await GameSession.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$totalScore' },
        maxScore: { $max: '$totalScore' },
        avgLives: { $avg: '$livesRemaining' },
        avgStreak: { $avg: '$streakAchieved' },
      },
    },
  ]);

  const [analyticsAgg] = await Analytics.aggregate([
    {
      $group: {
        _id: null,
        avgDetection: { $avg: '$phishingDetectionRate' },
        avgFalseAlarm: { $avg: '$falseAlarmRate' },
        avgComposite: { $avg: '$compositeScore' },
      },
    },
  ]);

  const [attemptAgg] = await StimulusAttempt.aggregate([
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
      },
    },
  ]);

  const attemptAccuracy =
    attemptAgg && attemptAgg.attempts > 0 ? Math.round((attemptAgg.correct / attemptAgg.attempts) * 100) : 0;

  return {
    ...totals,
    avgScore: scoreAgg?.avgScore ? Math.round(scoreAgg.avgScore) : 0,
    maxScore: scoreAgg?.maxScore ?? 0,
    avgLivesRemaining: scoreAgg?.avgLives ? Number(scoreAgg.avgLives.toFixed(2)) : 0,
    avgStreakAchieved: scoreAgg?.avgStreak ? Number(scoreAgg.avgStreak.toFixed(2)) : 0,
    avgPhishingDetectionRate: analyticsAgg?.avgDetection ? Number(analyticsAgg.avgDetection.toFixed(2)) : 0,
    avgFalseAlarmRate: analyticsAgg?.avgFalseAlarm ? Number(analyticsAgg.avgFalseAlarm.toFixed(2)) : 0,
    avgCompositeScore: analyticsAgg?.avgComposite ? Number(analyticsAgg.avgComposite.toFixed(2)) : 0,
    overallAttemptAccuracy: attemptAccuracy,
    totalAttempts: attemptAgg?.attempts ?? 0,
  };
}

/** Per-category accuracy aggregated across all attempts. */
export async function categoryAnalytics() {
  return StimulusAttempt.aggregate([
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        total: 1,
        correct: 1,
        accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', { $max: ['$total', 1] }] }, 100] }, 1] },
      },
    },
    { $sort: { category: 1 } },
  ]);
}

/** Per-tier accuracy aggregated across all attempts. */
export async function tierAnalytics() {
  return StimulusAttempt.aggregate([
    {
      $group: {
        _id: '$tier',
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        tier: '$_id',
        total: 1,
        correct: 1,
        accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', { $max: ['$total', 1] }] }, 100] }, 1] },
      },
    },
    { $sort: { tier: 1 } },
  ]);
}

/** Highest-scoring completed sessions. */
export async function leaderboard(limit = 10) {
  return GameSession.find({ status: 'completed' })
    .sort({ totalScore: -1, streakAchieved: -1, createdAt: 1 })
    .limit(limit)
    .populate('player', 'playerId name -_id')
    .lean();
}

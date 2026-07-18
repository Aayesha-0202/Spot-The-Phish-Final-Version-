import { Player } from '../models/Player';
import { GameSession } from '../models/GameSession';
import { StimulusAttempt } from '../models/StimulusAttempt';
import { Stimulus } from '../models/Stimulus';
import { Analytics } from '../models/Analytics';
import { LeaderboardEntry } from '../models/LeaderboardEntry';
import { PlayerStimulusHistory } from '../models/PlayerStimulusHistory';
import { ApiError } from '../utils/ApiError';
import { isDbConnected } from '../config/db';
import type { IPlayerStimulusHistory } from '../types';

// ---------------------------------------------------------------------------
// Dashboard Overview
// ---------------------------------------------------------------------------

export async function getDashboardOverview() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30);

  const [
    totalPlayers,
    activeToday,
    activeWeek,
    activeMonth,
    totalSessions,
    completedSessions,
    scoreAgg,
    accuracyAgg,
    completionTimeAgg,
  ] = await Promise.all([
    Player.countDocuments(),
    Player.countDocuments({ updatedAt: { $gte: todayStart } }),
    Player.countDocuments({ updatedAt: { $gte: weekStart } }),
    Player.countDocuments({ updatedAt: { $gte: monthStart } }),
    GameSession.countDocuments(),
    GameSession.countDocuments({ status: 'completed' }),
    GameSession.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$totalScore' }, totalStimuli: { $sum: '$stimuliAttempted' } } },
    ]),
    Analytics.aggregate([
      { $group: { _id: null, avgAccuracy: { $avg: '$stimulusAccuracy' } } },
    ]),
    GameSession.aggregate([
      { $match: { status: 'completed', completionTimeMs: { $gt: 0 } } },
      { $group: { _id: null, avgTime: { $avg: '$completionTimeMs' } } },
    ]),
  ]);

  // Daily players (last 30 days)
  const dailyPlayers = await Player.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Games played trend (last 30 days)
  const gamesTrend = await GameSession.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Score trend (last 30 days)
  const scoreTrend = await GameSession.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, avgScore: { $avg: '$totalScore' } } },
    { $sort: { _id: 1 } },
  ]);

  // Accuracy trend (last 30 days)
  const accuracyTrend = await Analytics.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, avgAccuracy: { $avg: '$stimulusAccuracy' } } },
    { $sort: { _id: 1 } },
  ]);

  // Weekly players (last 12 weeks)
  const weeklyPlayers = await Player.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Monthly players (last 12 months)
  const monthlyPlayers = await Player.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    summary: {
      totalPlayers,
      activeToday,
      activeWeek,
      activeMonth,
      totalGamesPlayed: totalSessions,
      totalStimuliViewed: scoreAgg[0]?.totalStimuli ?? 0,
      averageScore: scoreAgg[0]?.avgScore ? Math.round(scoreAgg[0].avgScore) : 0,
      averageAccuracy: accuracyAgg[0]?.avgAccuracy ? Math.round(accuracyAgg[0].avgAccuracy * 10) / 10 : 0,
      averageCompletionTime: completionTimeAgg[0]?.avgTime ? Math.round(completionTimeAgg[0].avgTime) : 0,
    },
    charts: { dailyPlayers, weeklyPlayers, monthlyPlayers, gamesTrend, scoreTrend, accuracyTrend },
  };
}

// ---------------------------------------------------------------------------
// Player Management
// ---------------------------------------------------------------------------

export async function getPlayers(params: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 20 } = params;
  const filter: any = {};
  if (search) {
    filter.$or = [
      { playerId: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [players, total] = await Promise.all([
    Player.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Player.countDocuments(filter),
  ]);

  // Enrich with session data
  const enriched = await Promise.all(
    players.map(async (p) => {
      const sessions = await GameSession.find({ playerId: p.playerId, status: 'completed' })
        .sort({ createdAt: -1 })
        .lean();
      const latestSession = sessions[0];
      const lastPlayedAt = latestSession?.endTime || latestSession?.createdAt;

      // Rank
      const leaderboardEntry = await LeaderboardEntry.findOne({
        $or: [{ user: p.user }, { playerId: p.playerId }],
      }).lean();

      const rank = leaderboardEntry
        ? (await LeaderboardEntry.countDocuments({ compositeScore: { $gt: leaderboardEntry.compositeScore } })) + 1
        : null;

      // Status
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const status = lastPlayedAt && new Date(lastPlayedAt) > threeDaysAgo ? 'Active' : 'Inactive';

      return {
        playerId: p.playerId,
        codename: p.name,
        email: p.email || null,
        gamesPlayed: sessions.length,
        latestScore: latestSession?.totalScore ?? null,
        accuracy: null as number | null,
        rank,
        lastPlayedAt,
        status,
        createdAt: p.createdAt,
      };
    })
  );

  return { players: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPlayerProfile(playerId: string) {
  const player = await Player.findOne({ playerId }).lean();
  if (!player) throw ApiError.notFound('Player not found');

  const sessions = await GameSession.find({ playerId, status: 'completed' }).sort({ createdAt: -1 }).lean();
  const leaderboardEntry = await LeaderboardEntry.findOne({
    $or: [{ user: player.user }, { playerId }],
  }).lean();

  const rank = leaderboardEntry
    ? (await LeaderboardEntry.countDocuments({ compositeScore: { $gt: leaderboardEntry.compositeScore } })) + 1
    : null;

  // Stimulus history
  const history = await PlayerStimulusHistory.findOne({ playerId }).lean();
  const allStimuli = await Stimulus.countDocuments({ status: { $ne: 'retired' } });
  const seenCount = history?.totalStimuliSeen ?? 0;

  // Tier-wise progress
  const tierProgress = [];
  for (let t = 1; t <= 5; t++) {
    const tierStimuli = await Stimulus.countDocuments({ tier: t, status: { $ne: 'retired' } });
    const seenKey = `tier${t}Seen` as keyof Pick<IPlayerStimulusHistory, 'tier1Seen' | 'tier2Seen' | 'tier3Seen' | 'tier4Seen' | 'tier5Seen'>;
    const seen = history ? ((history as any)[seenKey] as string[] | undefined)?.length ?? 0 : 0;
    tierProgress.push({ tier: t, seen, remaining: Math.max(0, tierStimuli - seen) });
  }

  // Accuracy from analytics
  const analyticsDocs = await Analytics.find({ playerId }).lean();
  const avgAccuracy = analyticsDocs.length > 0
    ? analyticsDocs.reduce((sum, a) => sum + (a.stimulusAccuracy ?? 0), 0) / analyticsDocs.length
    : null;

  // Avg completion time
  const avgTime = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.completionTimeMs ?? 0), 0) / sessions.length
    : null;

  return {
    player: {
      playerId: player.playerId,
      codename: player.name,
      email: player.email || null,
      createdAt: player.createdAt,
    },
    stats: {
      gamesPlayed: sessions.length,
      latestScore: sessions[0]?.totalScore ?? null,
      highestScore: sessions.length > 0 ? Math.max(...sessions.map((s) => s.totalScore)) : null,
      averageAccuracy: avgAccuracy ? Math.round(avgAccuracy * 10) / 10 : null,
      averageCompletionTime: avgTime ? Math.round(avgTime) : null,
      rank,
      stimuliSeen: seenCount,
      remainingUnseen: Math.max(0, allStimuli - seenCount),
    },
    tierProgress,
    recentSessions: sessions.slice(0, 10).map((s) => ({
      sessionId: s.sessionId,
      score: s.totalScore,
      designation: s.designation,
      completionTimeMs: s.completionTimeMs,
      completedAt: s.endTime || s.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Stimulus Review
// ---------------------------------------------------------------------------

export async function getStimuli(params: { search?: string; tier?: number; category?: string; status?: string; truthClass?: string; page?: number; limit?: number }) {
  const { search, tier, category, status, truthClass, page = 1, limit = 20 } = params;
  const filter: any = {};
  if (search) {
    filter.$or = [
      { stimulusId: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }
  if (tier) filter.tier = tier;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (truthClass) filter.truthClass = truthClass;

  const [stimuli, total] = await Promise.all([
    Stimulus.find(filter).sort({ tier: 1, stimulusId: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Stimulus.countDocuments(filter),
  ]);

  // Enrich with attempt data
  const enriched = await Promise.all(
    stimuli.map(async (s) => {
      const attempts = await StimulusAttempt.find({ stimulusId: s.stimulusId }).lean();
      const played = attempts.length;
      const correct = attempts.filter((a) => a.isCorrect).length;
      const incorrect = played - correct;
      const avgTime = played > 0
        ? attempts.reduce((sum, a) => sum + (a.responseTimeMs ?? 0), 0) / played
        : null;

      return {
        stimulusId: s.stimulusId,
        category: s.category,
        tier: s.tier,
        truthClass: s.truthClass,
        status: s.status,
        type: s.type,
        timesPlayed: played,
        correctPct: played > 0 ? Math.round((correct / played) * 100) : 0,
        incorrectPct: played > 0 ? Math.round((incorrect / played) * 100) : 0,
        avgResponseTimeMs: avgTime ? Math.round(avgTime) : null,
      };
    })
  );

  return { stimuli: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateStimulusStatus(stimulusId: string, status: 'active' | 'draft' | 'retired') {
  const stimulus = await Stimulus.findOneAndUpdate(
    { stimulusId },
    { $set: { status } },
    { new: true }
  ).lean();
  if (!stimulus) throw ApiError.notFound('Stimulus not found');
  return stimulus;
}

export async function bulkUpdateStimulusStatus(stimulusIds: string[], status: 'active' | 'draft' | 'retired') {
  const result = await Stimulus.updateMany(
    { stimulusId: { $in: stimulusIds } },
    { $set: { status } }
  );
  return { modified: result.modifiedCount };
}

export async function setAllStimulusStatus(status: 'active' | 'draft' | 'retired') {
  const result = await Stimulus.updateMany({}, { $set: { status } });
  return { modified: result.modifiedCount };
}

// ---------------------------------------------------------------------------
// Game Analytics
// ---------------------------------------------------------------------------

export async function getGameAnalytics() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30);

  const [totalGames, gamesToday, gamesWeek, gamesMonth] = await Promise.all([
    GameSession.countDocuments(),
    GameSession.countDocuments({ createdAt: { $gte: todayStart } }),
    GameSession.countDocuments({ createdAt: { $gte: weekStart } }),
    GameSession.countDocuments({ createdAt: { $gte: monthStart } }),
  ]);

  // Aggregate stats
  const [statsAgg] = await GameSession.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$totalScore' },
        avgTime: { $avg: '$completionTimeMs' },
        avgStreak: { $avg: '$streakAchieved' },
      },
    },
  ]);

  const [accuracyAgg] = await Analytics.aggregate([
    { $group: { _id: null, avgAccuracy: { $avg: '$stimulusAccuracy' } } },
  ]);

  // Round-wise accuracy
  const roundAccuracy = await StimulusAttempt.aggregate([
    { $group: { _id: '$tier', total: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } },
    { $project: { _id: 0, tier: '$_id', accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', { $max: ['$total', 1] }] }, 100] }, 1] }, total: 1, correct: 1 } },
    { $sort: { tier: 1 } },
  ]);

  // Score distribution
  const scoreDistribution = await GameSession.aggregate([
    { $match: { status: 'completed' } },
    {
      $bucket: {
        groupBy: '$totalScore',
        boundaries: [0, 20, 40, 60, 80, 100, 120, 150, 200],
        default: '200+',
        output: { count: { $sum: 1 } },
      },
    },
  ]);

  // Heatmap of wrong answers by category and tier
  const wrongAnswersHeatmap = await StimulusAttempt.aggregate([
    { $match: { isCorrect: false } },
    { $group: { _id: { category: '$category', tier: '$tier' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);

  return {
    summary: {
      totalGames,
      gamesToday,
      gamesWeek,
      gamesMonth,
      averageScore: statsAgg?.avgScore ? Math.round(statsAgg.avgScore) : 0,
      averageCompletionTime: statsAgg?.avgTime ? Math.round(statsAgg.avgTime) : 0,
      averageAccuracy: accuracyAgg?.avgAccuracy ? Math.round(accuracyAgg.avgAccuracy * 10) / 10 : 0,
    },
    roundAccuracy,
    scoreDistribution,
    wrongAnswersHeatmap,
  };
}

// ---------------------------------------------------------------------------
// Stimulus Analytics
// ---------------------------------------------------------------------------

export async function getStimulusAnalytics() {
  const stimuli = await Stimulus.find({ status: { $ne: 'retired' } }).lean();

  const analytics = await Promise.all(
    stimuli.map(async (s) => {
      const attempts = await StimulusAttempt.find({ stimulusId: s.stimulusId }).lean();
      const played = attempts.length;
      const correct = attempts.filter((a) => a.isCorrect).length;
      const avgTime = played > 0
        ? attempts.reduce((sum, a) => sum + (a.responseTimeMs ?? 0), 0) / played
        : null;

      return {
        stimulusId: s.stimulusId,
        category: s.category,
        tier: s.tier,
        truthClass: s.truthClass,
        timesPlayed: played,
        correctPct: played > 0 ? Math.round((correct / played) * 100) : 0,
        incorrectPct: played > 0 ? Math.round(((played - correct) / played) * 100) : 0,
        avgResponseTimeMs: avgTime ? Math.round(avgTime) : null,
        lastPlayed: attempts.length > 0 ? attempts[attempts.length - 1].timestamp : null,
      };
    })
  );

  const sorted = [...analytics].sort((a, b) => a.correctPct - b.correctPct);
  const hardest = sorted.filter((s) => s.timesPlayed > 0).slice(0, 20);
  const easiest = [...sorted].filter((s) => s.timesPlayed > 0).reverse().slice(0, 20);
  const mostPlayed = [...analytics].sort((a, b) => b.timesPlayed - a.timesPlayed).slice(0, 20);
  const leastPlayed = [...analytics].filter((s) => s.timesPlayed > 0).sort((a, b) => a.timesPlayed - b.timesPlayed).slice(0, 20);

  // Most misclassified (highest incorrect % with minimum plays)
  const misclassified = [...analytics]
    .filter((s) => s.timesPlayed >= 3)
    .sort((a, b) => b.incorrectPct - a.incorrectPct)
    .slice(0, 20);

  return { all: analytics, hardest, easiest, mostPlayed, leastPlayed, misclassified };
}

// ---------------------------------------------------------------------------
// Player Activity
// ---------------------------------------------------------------------------

export async function getPlayerActivity(limit = 50) {
  const recentSessions = await GameSession.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('player', 'playerId name')
    .lean();

  const activities = recentSessions.map((s) => {
    const player = s.player as any;
    let action = '';
    if (s.status === 'completed') {
      action = `completed assessment with score ${s.totalScore}`;
    } else if (s.status === 'active') {
      action = 'started a new game';
    } else {
      action = 'left an assessment';
    }

    return {
      playerId: s.playerId,
      codename: player?.name || 'Unknown',
      action,
      score: s.totalScore,
      timestamp: s.createdAt,
      sessionId: s.sessionId,
    };
  });

  return activities;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export async function getAdminLeaderboard() {
  const entries = await LeaderboardEntry.find()
    .sort({ compositeScore: -1, completionTimeMs: 1, completedAt: 1 })
    .lean();

  // Join with Player for live codename
  const enriched = await Promise.all(
    entries.map(async (e, i) => {
      const player = await Player.findOne({ playerId: e.playerId }).lean();
      return {
        rank: i + 1,
        playerId: e.playerId,
        codename: player?.name || 'ANONYMOUS',
        latestScore: e.compositeScore,
        accuracy: null as number | null,
        gamesPlayed: e.gamesPlayed,
        lastPlayedAt: e.completedAt,
      };
    })
  );

  return enriched;
}

// ---------------------------------------------------------------------------
// System Health
// ---------------------------------------------------------------------------

export async function getSystemHealth() {
  const dbConnected = isDbConnected();

  const [totalStimuli, enabledStimuli, disabledStimuli] = await Promise.all([
    Stimulus.countDocuments(),
    Stimulus.countDocuments({ status: 'active' }),
    Stimulus.countDocuments({ status: { $in: ['draft', 'retired'] } }),
  ]);

  // SMTP status — check if env vars are configured
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  return {
    backendStatus: 'Operational',
    databaseStatus: dbConnected ? 'Connected' : 'Disconnected',
    smtpStatus: smtpConfigured ? 'Configured' : 'Not Configured',
    applicationVersion: '1.0.0',
    totalStimuli,
    enabledStimuli,
    disabledStimuli,
  };
}

// ---------------------------------------------------------------------------
// Learning Insights
// ---------------------------------------------------------------------------

export async function getLearningInsights() {
  // Top 10 most misclassified stimuli
  const misclassified = await StimulusAttempt.aggregate([
    { $match: { isCorrect: false } },
    { $group: { _id: '$stimulusId', incorrectCount: { $sum: 1 } } },
    { $sort: { incorrectCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'stimuli',
        localField: '_id',
        foreignField: 'stimulusId',
        as: 'stimulus',
      },
    },
    { $unwind: { path: '$stimulus', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        stimulusId: '$_id',
        category: '$stimulus.category',
        tier: '$stimulus.tier',
        truthClass: '$stimulus.truthClass',
        incorrectCount: 1,
      },
    },
  ]);

  // Categories users fail the most
  const categoryFailures = await StimulusAttempt.aggregate([
    { $match: { isCorrect: false } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, category: '$_id', failureCount: '$count' } },
  ]);

  // Average response time by category
  const avgTimeByCategory = await StimulusAttempt.aggregate([
    { $match: { responseTimeMs: { $gt: 0 } } },
    { $group: { _id: '$category', avgTime: { $avg: '$responseTimeMs' } } },
    { $project: { _id: 0, category: '$_id', avgResponseTimeMs: { $round: ['$avgTime', 0] } } },
    { $sort: { avgResponseTimeMs: -1 } },
  ]);

  // Accuracy by tier
  const accuracyByTier = await StimulusAttempt.aggregate([
    { $group: { _id: '$tier', total: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } },
    {
      $project: {
        _id: 0,
        tier: '$_id',
        accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', { $max: ['$total', 1] }] }, 100] }, 1] },
        totalAttempts: '$total',
      },
    },
    { $sort: { tier: 1 } },
  ]);

  // Safe vs Phishing misclassification
  const misclassificationByClass = await StimulusAttempt.aggregate([
    { $match: { isCorrect: false } },
    {
      $lookup: {
        from: 'stimuli',
        localField: 'stimulusId',
        foreignField: 'stimulusId',
        as: 'stimulus',
      },
    },
    { $unwind: { path: '$stimulus', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$stimulus.truthClass', count: { $sum: 1 } } },
    { $project: { _id: 0, truthClass: '$_id', misclassifiedCount: '$count' } },
  ]);

  // Most skipped/slowest stimuli
  const slowestStimuli = await StimulusAttempt.aggregate([
    { $match: { responseTimeMs: { $gt: 0 } } },
    { $group: { _id: '$stimulusId', avgTime: { $avg: '$responseTimeMs' }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 3 } } },
    { $sort: { avgTime: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'stimuli',
        localField: '_id',
        foreignField: 'stimulusId',
        as: 'stimulus',
      },
    },
    { $unwind: { path: '$stimulus', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        stimulusId: '$_id',
        category: '$stimulus.category',
        tier: '$stimulus.tier',
        avgResponseTimeMs: { $round: ['$avgTime', 0] },
        timesPlayed: '$count',
      },
    },
  ]);

  // Performance trend over time
  const performanceTrend = await Analytics.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        avgAccuracy: { $avg: '$stimulusAccuracy' },
        avgScore: { $avg: '$compositeScore' },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        avgAccuracy: { $round: ['$avgAccuracy', 1] },
        avgScore: { $round: ['$avgScore', 0] },
      },
    },
    { $sort: { date: 1 } },
  ]);

  return {
    misclassifiedStimuli: misclassified,
    categoryFailures,
    avgTimeByCategory,
    accuracyByTier,
    misclassificationByClass,
    slowestStimuli,
    performanceTrend,
  };
}

// ---------------------------------------------------------------------------
// Exports (CSV data)
// ---------------------------------------------------------------------------

export async function exportLeaderboardCSV() {
  const entries = await LeaderboardEntry.find()
    .sort({ compositeScore: -1 })
    .lean();

  const rows = await Promise.all(
    entries.map(async (e, i) => {
      const player = await Player.findOne({ playerId: e.playerId }).lean();
      return {
        rank: i + 1,
        playerId: e.playerId,
        codename: player?.name || 'ANONYMOUS',
        score: e.compositeScore,
        gamesPlayed: e.gamesPlayed,
        lastPlayed: e.completedAt?.toISOString(),
      };
    })
  );

  return rows;
}

export async function exportPlayerAnalyticsCSV() {
  const sessions = await GameSession.find({ status: 'completed' })
    .populate('player', 'playerId name')
    .sort({ createdAt: -1 })
    .lean();

  return sessions.map((s) => {
    const player = s.player as any;
    return {
      sessionId: s.sessionId,
      playerId: s.playerId,
      codename: player?.name || 'Unknown',
      score: s.totalScore,
      designation: s.designation,
      completionTimeMs: s.completionTimeMs,
      streakAchieved: s.streakAchieved,
      completedLevels: s.completedLevels,
      playedAt: s.createdAt?.toISOString(),
    };
  });
}

export async function exportStimulusAnalyticsCSV() {
  const stimuli = await Stimulus.find().lean();

  return Promise.all(
    stimuli.map(async (s) => {
      const attempts = await StimulusAttempt.find({ stimulusId: s.stimulusId }).lean();
      const played = attempts.length;
      const correct = attempts.filter((a) => a.isCorrect).length;
      return {
        stimulusId: s.stimulusId,
        category: s.category,
        tier: s.tier,
        truthClass: s.truthClass,
        status: s.status,
        timesPlayed: played,
        correctPct: played > 0 ? Math.round((correct / played) * 100) : 0,
        incorrectPct: played > 0 ? Math.round(((played - correct) / played) * 100) : 0,
      };
    })
  );
}

export async function exportGameplayAnalyticsCSV() {
  const sessions = await GameSession.find({ status: 'completed' }).sort({ createdAt: -1 }).lean();

  return sessions.map((s) => ({
    sessionId: s.sessionId,
    playerId: s.playerId,
    score: s.totalScore,
    completionTimeMs: s.completionTimeMs,
    streakAchieved: s.streakAchieved,
    stimuliAttempted: s.stimuliAttempted,
    completedLevels: s.completedLevels,
    playedAt: s.createdAt?.toISOString(),
  }));
}

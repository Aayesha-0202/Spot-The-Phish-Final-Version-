import type { Document, Types } from 'mongoose';

export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type ReadinessLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'ELITE';

// ---------------------------------------------------------------------------
// Players & game (existing, lightly extended for auth + email)
// ---------------------------------------------------------------------------
export interface IPlayer extends Document {
  playerId: string;
  name: string;
  user?: Types.ObjectId | null;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISession extends Document {
  sessionId: string;
  player: Types.ObjectId;
  playerId: string;
  user?: Types.ObjectId | null;
  email?: string;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  totalScore: number;
  designation?: string;
  readinessLevel?: ReadinessLevel;
  completedLevels: number;
  livesRemaining: number;
  streakAchieved: number;
  stimuliAttempted: number;
  reportSummary?: string;
  rounds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttempt extends Document {
  sessionId: string;
  session: Types.ObjectId;
  player: Types.ObjectId;
  playerId: string;
  stimulusId: string;
  category: string;
  tier: number;
  roundNumber?: number;
  playerChoice?: string;
  correctAnswer?: unknown;
  investigations?: unknown;
  isCorrect: boolean;
  scoreAwarded: number;
  responseTimeMs?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnalytics extends Document {
  sessionId: string;
  session: Types.ObjectId;
  player: Types.ObjectId;
  playerId: string;
  strongestCategory?: string;
  weakestCategory?: string;
  categoryAccuracy?: Record<string, number>;
  tierAccuracy?: Record<string, number>;
  phishingDetectionRate?: number;
  falseAlarmRate?: number;
  compositeScore?: number;
  designation?: string;
  readinessLevel?: ReadinessLevel;
  reportSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  readinessSummary?: string;
  threatsCaughtPct?: number;
  stimulusAccuracy?: number;
  stimuliCorrect?: number;
  stimuliTotal?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Auth: Users, RefreshTokens, PasswordResets
// ---------------------------------------------------------------------------
export interface IUserProfile {
  avatarUrl?: string;
  designation?: string;
}

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash?: string | null;
  googleId?: string | null;
  emailVerified: boolean;
  profile: IUserProfile;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefreshToken extends Document {
  tokenHash: string;
  user: Types.ObjectId;
  jti: string;
  expiresAt: Date;
  revoked: boolean;
  replacedBy?: string;
  createdAt: Date;
}

export interface IPasswordReset extends Document {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Rounds, Stimuli library, Exposure counters
// ---------------------------------------------------------------------------
export interface IRound extends Document {
  sessionId: string;
  session: Types.ObjectId;
  player: Types.ObjectId;
  playerId: string;
  roundNumber: number; // 1..5
  tier: number; // 1..5
  status: SessionStatus;
  scoreAwarded: number;
  correctCount: number;
  incorrectCount: number;
  stimuliAttempted: number;
  avgResponseTimeMs?: number;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TruthClass = 'phish' | 'legit';
export type StimulusStatus = 'active' | 'draft' | 'retired';

export interface IStimulus extends Document {
  stimulusId: string;
  type?: string;
  category: string;
  tier: number;
  truthClass: TruthClass;
  cueList: string[];
  calibration: Record<string, unknown>;
  renderedAssets: Record<string, unknown>;
  language: string;
  status: StimulusStatus;
  exposureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExposureCounter extends Document {
  stimulusId: string;
  sessionId: string;
  shownAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export interface ILeaderboardEntry extends Document {
  user?: Types.ObjectId | null;
  playerId: string;
  playerName: string;
  sessionId: string;
  compositeScore: number;
  designation?: string;
  readinessLevel?: ReadinessLevel;
  highestStreak: number;
  stimuliCorrect: number;
  stimuliIncorrect: number;
  avgResponseTimeMs?: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Standardised API envelope (mirrors utils/response.ts). */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Shape attached to req by the auth middleware. */
export interface AuthUser {
  _id: string;
  email: string;
  username: string;
}

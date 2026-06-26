import { z } from 'zod';

export const submitLeaderboardSchema = z.object({
  sessionId: z.string().min(8).max(64),
  // Optional client claim — compared against the server-recomputed score but
  // never trusted for persistence.
  clientScore: z.number().min(0).optional(),
});

export const periodEnum = z.enum(['today', 'week', 'month', 'all']);
export type LeaderboardPeriod = z.infer<typeof periodEnum>;

export const topQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(10),
  period: periodEnum.optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

export const periodQuerySchema = z.object({
  period: periodEnum.default('all'),
});

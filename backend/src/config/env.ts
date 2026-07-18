import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Centralised, validated environment configuration.
 * The app refuses to boot if required env vars are missing/invalid.
 *
 * NOTE: the MongoDB connection string is read from MONGODB_URI only — it is
 * never hardcoded anywhere in the codebase.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // ---- MongoDB ----
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default('mongodb://localhost:27017/spot_the_phish'),

  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),

  // ---- Rate limiting ----
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  API_DOCS_PATH: z.string().default('/api/docs'),

  // ---- Auth (JWT) ----
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_DOMAIN: z.string().optional(), // e.g. "localhost" or your prod domain

  // ---- Google OAuth (ID-token verification) ----
  GOOGLE_CLIENT_ID: z.string().optional(),

  // ---- Email (Nodemailer SMTP) ----
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().optional(), // e.g. "Spot the Phish <noreply@example.com>"
  EMAIL_FROM_NAME: z.string().default('Spot the Phish'),
  EMAIL_FROM_ADDRESS: z.string().optional(), // used when SMTP_FROM is unset
  ENABLE_PDF_REPORT: z.coerce.boolean().default(true),

  // ---- Leaderboard ----
  LEADERBOARD_TOP_MAX: z.coerce.number().int().positive().default(50),

  // ---- App behaviour ----
  // When true, forgot-password/reset links are printed to the server log instead of
  // emailed — handy for local dev without an SMTP server configured.
  PRINT_RESET_LINKS: z.coerce.boolean().default(false),

  // ---- Admin ----
  ADMIN_USERNAME: z.string().min(1, 'ADMIN_USERNAME is required'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  ADMIN_JWT_SECRET: z.string().min(16, 'ADMIN_JWT_SECRET must be at least 16 chars'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:\n', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

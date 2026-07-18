import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { verifyMailer } from './config/mailer';
import { deduplicateLeaderboard, startBackgroundDedup } from './services/leaderboardService';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    const app = createApp();

    // Kick off Mongo connection in the background (fail-graceful — see config/db.ts).
    // The HTTP server starts regardless of Mongo availability.
    connectDB()
      .then(() => deduplicateLeaderboard())
      .then(() => startBackgroundDedup())
      .catch((err) => logger.error('Initial Mongo connect failed:', (err as Error).message));

    // Verify the SMTP transport — log clearly so config issues are visible.
    verifyMailer()
      .then(() => logger.info('✅ SMTP transport ready — report emails will be delivered'))
      .catch((err) => logger.error('❌ SMTP transport verification FAILED — report emails will NOT send:', (err as Error).message));

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Spot the Phish API ready on http://localhost:${env.PORT}`);
      logger.info(`📚 Swagger docs at  http://localhost:${env.PORT}${env.API_DOCS_PATH}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down...`);
      server.close(() => logger.info('HTTP server closed.'));
      await disconnectDB();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', (reason as Error)?.message);
    });
  } catch (err) {
    logger.error('Fatal: failed to start server', (err as Error)?.message);
    process.exit(1);
  }
}

bootstrap();

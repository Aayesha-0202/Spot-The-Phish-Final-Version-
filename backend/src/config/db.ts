import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let connected = false;
let connecting = false;

/**
 * Connect to MongoDB using the validated MONGODB_URI (never hardcoded).
 *
 * Fail-graceful: the HTTP server starts regardless of Mongo availability.
 * We retry in the background with exponential backoff and auto-reconnect if the
 * database drops. Endpoints that need Mongo throw ApiError(503) via isDbConnected().
 */
async function attemptConnect(attempt: number): Promise<void> {
  if (connecting || connected) return;
  connecting = true;
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    connected = true;
    connecting = false;
    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
  } catch (err) {
    connecting = false;
    const delay = Math.min(1000 * 2 ** attempt, 30000);
    logger.error(`❌ MongoDB connection attempt ${attempt + 1} failed: ${(err as Error).message} — retrying in ${Math.round(delay / 1000)}s`);
    setTimeout(() => attemptConnect(attempt + 1).catch(() => undefined), delay);
  }
}

/** Kick off the (background) connection. Non-blocking; never throws. */
export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => {
    if (connected) logger.warn('⚠️ MongoDB disconnected — will attempt to reconnect');
    connected = false;
    attemptConnect(0).catch(() => undefined);
  });
  mongoose.connection.on('reconnected', () => {
    connected = true;
    logger.info('✅ MongoDB reconnected');
  });

  await attemptConnect(0);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  connected = false;
  logger.info('MongoDB disconnected');
}

/** Whether Mongo is currently reachable. Routes use this to return 503 gracefully. */
export function isDbConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

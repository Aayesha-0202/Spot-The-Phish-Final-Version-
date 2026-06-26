import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './utils/logger';
import { isDbConnected } from './config/db';
import { apiRateLimiter } from './middleware/rateLimiter';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { swaggerSpec } from './config/swagger';

export function createApp() {
  const app = express();

  // --- Security & platform middleware ---
  app.use(helmet());
  app.use(
    cors({
      // Allow the configured client origin (and any explicitly-listed extras).
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' })); // report emails carry a base64 PNG
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());

  // --- Request logging ---
  app.use(
    morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined', {
      stream: { write: (msg: string) => logger.info(msg.trim()) },
    })
  );

  // --- Health + docs ---
  app.get('/health', (_req: Request, res: Response) => {
    const db = isDbConnected();
    res
      .status(db ? 200 : 503)
      .json({ success: db, message: db ? 'OK' : 'degraded', data: { status: db ? 'healthy' : 'degraded', db: db ? 'ok' : 'unavailable', time: new Date().toISOString() } });
  });
  app.use(env.API_DOCS_PATH, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // --- API ---
  app.use('/api', apiRateLimiter, apiRoutes);

  // --- 404 + centralized error handler ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

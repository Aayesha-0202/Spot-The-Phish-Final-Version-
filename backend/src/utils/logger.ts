import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_PRIORITY: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level: Level): boolean {
  if (env.NODE_ENV === 'production') return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY.info;
  return true;
}

function fmt(level: Level, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  return meta !== undefined ? `[${ts}] ${level.toUpperCase()} ${msg} ${JSON.stringify(meta)}` : `[${ts}] ${level.toUpperCase()} ${msg}`;
}

/** Lightweight logger (no external deps). Swap for pino/winston if needed. */
export const logger = {
  info: (msg: string, meta?: unknown) => shouldLog('info') && console.log(fmt('info', msg, meta)),
  warn: (msg: string, meta?: unknown) => shouldLog('warn') && console.warn(fmt('warn', msg, meta)),
  error: (msg: string, meta?: unknown) => shouldLog('error') && console.error(fmt('error', msg, meta)),
  debug: (msg: string, meta?: unknown) => shouldLog('debug') && console.debug(fmt('debug', msg, meta)),
};

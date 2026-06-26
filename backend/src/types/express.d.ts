import type { AuthUser } from './index';

// Augment Express Request with the authenticated user attached by middleware/auth.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}

export {};

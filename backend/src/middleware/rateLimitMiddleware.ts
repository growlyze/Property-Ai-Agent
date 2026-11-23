import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * General API rate limit.
 *
 * The dashboard is a single-page app that fires several API calls per screen
 * (and refreshes some every minute), so the original 100 requests / 15 min
 * per IP was exhausted by one active user; combined with the proxy issue
 * fixed in app.ts (every visitor seen as the proxy's IP) it locked the whole
 * site for everyone. Default is now 1000 / 15 min, configurable with
 * RATE_LIMIT_MAX_REQUESTS / RATE_LIMIT_WINDOW_MS. Health checks are exempt.
 * Login and registration keep their own, much stricter limiters.
 */
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/api/health' || req.path === '/health',
});

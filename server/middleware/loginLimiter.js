const rateLimit = require('express-rate-limit');

const WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 10;

// Counts FAILED logins per client IP (responses with status >= 400). Successful logins are free.
// After MAX_FAILED_ATTEMPTS failures the IP is blocked for the rest of the window, even with the
// right password. Client IP comes from req.ip, so `trust proxy` must match the proxy chain (index.js).
const loginLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,
  limit: MAX_FAILED_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[auth] login rate limit hit from ${req.ip}`);
    res.status(429).json({
      error: `Too many failed login attempts. Try again in ${WINDOW_MINUTES} minutes.`,
    });
  },
});

module.exports = { loginLimiter };

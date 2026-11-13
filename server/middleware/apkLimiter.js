const rateLimit = require('express-rate-limit');

// Download limits for the Android APK, so a big file cannot be used to drain the server's bandwidth.
// Per visitor IP: a few downloads per hour and per day, and at most 2 at the same time.
// All numbers can be changed with environment variables.
const intEnv = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
const PER_HOUR = intEnv('APK_DOWNLOADS_PER_HOUR', 5);
const PER_DAY = intEnv('APK_DOWNLOADS_PER_DAY', 20);
const MAX_PER_IP = intEnv('APK_CONCURRENT_PER_IP', 2);
const MAX_TOTAL = intEnv('APK_MAX_CONCURRENT', 25);

// HEAD checks and "resume an interrupted download" requests (Range not starting at 0) do not count
const skip = (req) => req.method === 'HEAD' || /^bytes=(?!0-)/.test(req.headers.range || '');

// Only real browser navigation (Accept includes text/html) gets the friendly page; apps and scripts get JSON
const wantsHtml = (req) => /text\/html/.test(req.headers.accept || '');

function tooMany(req, res, message, seconds) {
  const wait = Math.max(1, Math.ceil(seconds));
  res.set('Retry-After', String(wait));
  res.status(429);
  if (wantsHtml(req)) {
    const minutes = Math.ceil(wait / 60);
    const when = wait < 90 ? 'in about a minute' : `in about ${minutes} minutes`;
    res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Download limit reached</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0D0D0D;color:#F5F5F7;font-family:system-ui,sans-serif;padding:1.5rem;text-align:center">
<div style="max-width:420px"><h1 style="font-size:1.4rem;margin:0 0 .75rem">Download limit reached</h1>
<p style="color:#8E8E93;line-height:1.6;margin:0 0 1.5rem">${message} Please try again ${when}.</p>
<a href="/" style="color:#D4AF37">Back to the shop</a></div></body>`);
  } else {
    res.json({ error: `${message} Please try again later.`, retryAfterSeconds: wait });
  }
}

const makeLimiter = (windowMs, limit, label) => rateLimit({
  windowMs,
  limit,
  skip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    const seconds = req.rateLimit?.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 600;
    console.warn(`[apk] ${label} download limit hit from ${req.ip}`);
    tooMany(req, res, `The ${label} download limit for this connection has been reached.`, seconds);
  },
});

const hourly = makeLimiter(60 * 60 * 1000, PER_HOUR, 'hourly');
const daily = makeLimiter(24 * 60 * 60 * 1000, PER_DAY, 'daily');

// At most MAX_PER_IP downloads in progress per IP, MAX_TOTAL for the whole server
const active = new Map();
let total = 0;
function concurrencyGuard(req, res, next) {
  if (skip(req) && req.method === 'HEAD') return next();
  const ip = req.ip;
  const mine = active.get(ip) || 0;
  if (mine >= MAX_PER_IP || total >= MAX_TOTAL) {
    console.warn(`[apk] too many downloads in progress (${ip})`);
    return tooMany(req, res, 'Too many downloads are in progress right now.', 30);
  }
  active.set(ip, mine + 1);
  total += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const left = (active.get(ip) || 1) - 1;
    if (left <= 0) active.delete(ip); else active.set(ip, left);
    total -= 1;
  };
  res.on('close', release);
  res.on('finish', release);
  return next();
}

module.exports = { downloadLimits: [concurrencyGuard, hourly, daily], limits: { PER_HOUR, PER_DAY, MAX_PER_IP, MAX_TOTAL } };

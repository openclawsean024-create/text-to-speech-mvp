/**
 * Simple in-memory rate limiter for Vercel serverless.
 * Cold-start resets, so this is best-effort — not a hard security control.
 *
 * Plans:
 *   free  : 10 req/day
 *   starter: 100 req/day
 *   pro    : 1000 req/day
 */

const LIMITS = {
  free:    { requests: 10,  windowMs: 86400000 },   // 1 day
  starter: { requests: 100, windowMs: 86400000 },
  pro:     { requests: 1000, windowMs: 86400000 },
};

// In-memory store (resets on cold start)
const usage = new Map(); // key → { count, resetAt }

function getKey(req) {
  // Use x-forwarded-for header or fallback
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';
}

function rateLimit(plan = 'free') {
  const limit = LIMITS[plan] || LIMITS.free;
  return (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();

    let record = usage.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + limit.windowMs };
      usage.set(key, record);
    }

    record.count++;

    res.setHeader('X-RateLimit-Limit', limit.requests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.requests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > limit.requests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit: limit.requests,
        resetsAt: new Date(record.resetAt).toISOString(),
        upgrade: plan === 'free'
          ? 'Consider upgrading to starter or pro plan'
          : undefined,
      });
    }

    next();
  };
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of usage.entries()) {
    if (now > record.resetAt + 60000) usage.delete(key);
  }
}, 300000);

module.exports = { rateLimit, LIMITS };

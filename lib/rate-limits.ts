/**
 * Re-export rate limits for use in TypeScript files
 */

const LIMITS = {
  free:    { requests: 10,  windowMs: 86400000 },
  starter: { requests: 100, windowMs: 86400000 },
  pro:     { requests: 1000, windowMs: 86400000 },
}

export { LIMITS }

/**
 * Simple in-memory rate limiter for production abuse protection.
 * Suitable for single-instance deployments; replace with Redis for multi-instance.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { allowed: true, remaining: params.limit - 1, retryAfterSec: 0 };
  }
  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: params.limit - existing.count,
    retryAfterSec: 0,
  };
}

/** Best-effort cleanup to avoid unbounded memory in long-running processes. */
export function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

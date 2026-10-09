export type RateWindow = {
  windowStartMs: number;
  count: number;
};

export function rateLimitBlocked(
  current: RateWindow | null,
  nowMs: number,
  options: { limit: number; windowMs: number },
) {
  if (!current) return false;
  if (nowMs - current.windowStartMs >= options.windowMs) return false;
  return current.count >= options.limit;
}

export function advanceRateLimit(
  current: RateWindow | null,
  nowMs: number,
  options: { limit: number; windowMs: number },
): { next: RateWindow; blocked: boolean } {
  if (!current || nowMs - current.windowStartMs >= options.windowMs) {
    return { next: { windowStartMs: nowMs, count: 1 }, blocked: false };
  }
  const count = current.count + 1;
  return {
    next: { windowStartMs: current.windowStartMs, count },
    blocked: count > options.limit,
  };
}

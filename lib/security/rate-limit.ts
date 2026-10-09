export type RateState = {
  windowStartMs: number;
  count: number;
  lockedUntilMs: number | null;
};

export function rateLimitBlocked(
  current: RateState | null,
  nowMs: number,
  options: { limit: number; windowMs: number },
) {
  if (!current) return false;
  if (current.lockedUntilMs !== null && nowMs < current.lockedUntilMs) return true;
  if (nowMs - current.windowStartMs >= options.windowMs) return false;
  return current.count >= options.limit;
}

export function advanceRateLimit(
  current: RateState | null,
  nowMs: number,
  options: { limit: number; windowMs: number; lockoutMs: number },
): { next: RateState; blocked: boolean } {
  if (rateLimitBlocked(current, nowMs, options)) {
    const lockedUntilMs =
      current?.lockedUntilMs && current.lockedUntilMs > nowMs
        ? current.lockedUntilMs
        : nowMs + options.lockoutMs;
    return {
      blocked: true,
      next: {
        windowStartMs: current?.windowStartMs ?? nowMs,
        count: current?.count ?? options.limit,
        lockedUntilMs,
      },
    };
  }
  if (!current || nowMs - current.windowStartMs >= options.windowMs) {
    return {
      blocked: false,
      next: { windowStartMs: nowMs, count: 1, lockedUntilMs: null },
    };
  }
  const count = current.count + 1;
  const lockedUntilMs = count >= options.limit ? nowMs + options.lockoutMs : null;
  return {
    blocked: false,
    next: { windowStartMs: current.windowStartMs, count, lockedUntilMs },
  };
}

export function anyRateLimited(states: boolean[]) {
  return states.some(Boolean);
}

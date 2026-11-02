// Attempt limiter: a sliding window of attempt times per key (`ip:<address>`, `account:<email>`, `reset:<email>`,
// `signup:ip:<address>`, `confirm:ip:<address>`).
// In-process memory: right for one server process; several processes need a shared store (Redis, the database).
const WINDOW = 15 * 60 * 1000;
const MAX_KEYS = 10_000;
const KEY = Symbol.for("rivet.example.auth-sessions.limits");
/** Key → failure times (ms), oldest first. On `globalThis`: one store per process (tests clear it between cases). */
export const failures = ((globalThis as Record<symbol, Map<string, number[]> | undefined>)[KEY] ??= new Map());

/**
 * Limits per 15 minutes: failed sign-ins per client address (`RATE_LIMIT_IP`, default 20) and per account
 * (`RATE_LIMIT_ACCOUNT`, 5); reset mails per email (3); sign-up attempts per client address (`RATE_LIMIT_SIGNUP`, 10);
 * invalid reset-confirm tokens per client address (`RATE_LIMIT_CONFIRM`, 10).
 */
export const limits = () => ({
  ip: Number(process.env.RATE_LIMIT_IP) || 20,
  account: Number(process.env.RATE_LIMIT_ACCOUNT) || 5,
  reset: 3,
  signup: Number(process.env.RATE_LIMIT_SIGNUP) || 10,
  confirm: Number(process.env.RATE_LIMIT_CONFIRM) || 10,
});

function recent(key: string, now: number): number[] {
  const list = failures.get(key);
  if (!list) return [];
  while (list.length && list[0]! <= now - WINDOW) list.shift();
  if (!list.length) failures.delete(key);
  return list;
}

/** Seconds until `key` may try again (0 = allowed now). */
export function retryAfter(key: string, max: number, now = Date.now()): number {
  const list = recent(key, now);
  return list.length < max ? 0 : Math.ceil((list[list.length - max]! + WINDOW - now) / 1000);
}

export function recordFailure(key: string, now = Date.now()): void {
  if (failures.size >= MAX_KEYS && !failures.has(key)) {
    // Full: drop stale keys, then the oldest ones (an attacker spraying addresses can evict counters: the bound keeps
    // memory flat, a shared store with TTLs avoids the trade-off).
    for (const k of failures.keys()) recent(k, now);
    for (const k of failures.keys()) {
      if (failures.size < MAX_KEYS) break;
      failures.delete(k);
    }
  }
  const list = failures.get(key) ?? [];
  list.push(now);
  failures.set(key, list);
}

export const clearFailures = (key: string): void => void failures.delete(key);

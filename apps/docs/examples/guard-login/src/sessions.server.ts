// Server-only module (the `.server.ts` name keeps it out of browser code).
// Sessions live in memory for the demo; a real app stores them in a database.
// Bounded: expired entries go on every sign-in, and past MAX the oldest go.
const TTL = 60 * 60 * 1000; // the login cookie's maxAge (1 hour)
const MAX = 10_000;
const sessions = new Map<string, { user: string; expires: number }>();

export function createSession(user: string): string {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
  while (sessions.size >= MAX) sessions.delete(sessions.keys().next().value!);
  const id = crypto.randomUUID();
  sessions.set(id, { user, expires: now + TTL });
  return id;
}
export function userFor(id: string | undefined): string | undefined {
  const session = id ? sessions.get(id) : undefined;
  return session && session.expires > Date.now() ? session.user : undefined;
}
export function endSession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

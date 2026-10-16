// Server-only module (the `.server.ts` name keeps it out of browser code).
// Sessions live in memory for the demo; a real app stores them in a database.
const sessions = new Map<string, string>();

export function createSession(user: string): string {
  const id = crypto.randomUUID();
  sessions.set(id, user);
  return id;
}
export const userFor = (id: string | undefined): string | undefined => (id ? sessions.get(id) : undefined);
export function endSession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

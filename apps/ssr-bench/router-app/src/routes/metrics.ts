// Bench control endpoint: process memory (request counters live in `server.ts` lanes only).
export function onGet() {
  return Response.json({ ...process.memoryUsage() });
}

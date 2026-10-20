// Bench control endpoint: process memory (request counters live in `server.ts` lanes only).
import { onGet } from "@rivetjs/router";
export const GET = onGet(() => {
  return Response.json({ ...process.memoryUsage() });
});

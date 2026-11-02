import { onPost, type RequestEvent } from "@rivetjs/router";
import { backend } from "../../server/backend.server.ts";
const MAX_TASKS = 1000;
export const POST = onPost(async ({ request, url }: RequestEvent) => {
  const token = url.searchParams.get("token") ?? "default";
  let body: { version?: unknown; title?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof body.version !== "number" || typeof body.title !== "string")
    return Response.json({ error: "Expected { version: number, title: string }" }, { status: 400 });
  const previous = backend.tasks.get(token) ?? { version: 0, title: "" };
  if (body.version !== previous.version) return Response.json(previous, { status: 409 });
  const next = { version: previous.version + 1, title: body.title };
  // Keyed by a client-chosen token: bounded, the oldest token goes first.
  if (!backend.tasks.has(token) && backend.tasks.size >= MAX_TASKS) backend.tasks.delete(backend.tasks.keys().next().value!);
  backend.tasks.set(token, next);
  return Response.json(next);
});

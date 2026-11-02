import { onPost } from "@rivetjs/router";
import { getDb, importBookmarks } from "../../server/db.server.ts";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * `POST /api/import` with a JSON array of `{ title, url, tags }`: all or nothing. The router caps the body (`maxBody`,
 * 1 MiB by default: 413 before this handler reads it). No authentication: this is a single-user local app (the
 * router's CSRF check still refuses cross-site posts); put it behind a guard before exposing it on a network.
 */
export const POST = onPost(async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body is not JSON" }, 400);
  }
  const r = importBookmarks(getDb(), body);
  return "error" in r ? json(r, 400) : json(r, 200);
});

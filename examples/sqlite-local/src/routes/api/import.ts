import { onPost } from "@rivetjs/router";
import { getDb, importBookmarks } from "../../server/db.server.ts";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** `POST /api/import` with a JSON array of `{ title, url, tags }`: all or nothing. */
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

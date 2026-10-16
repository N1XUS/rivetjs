import type { RequestEvent } from "@rivetjs/router";
import { addNote, listNotes } from "../../notes.server.ts";

// #region demo
// GET /api/notes
export const onGet = () => Response.json(listNotes(), { headers: { "cache-control": "no-store" } });

// POST /api/notes with a JSON body. Cross-site posts from other origins get 403 before this runs.
export const onPost = async ({ request }: RequestEvent) => {
  const body = (await request.json()) as { text?: unknown };
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 200) return Response.json({ error: "invalid text" }, { status: 400 });
  return Response.json(addNote(body.text.trim()), { status: 201 });
};
// #endregion

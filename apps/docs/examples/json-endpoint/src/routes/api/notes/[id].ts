import type { RequestEvent } from "@rivetjs/router";
import { findNote } from "../../../notes.server.ts";

// GET /api/notes/1: a JSON 404 instead of the HTML error page.
export const onGet = ({ params }: RequestEvent<{ id: string }>) => {
  const note = findNote(Number(params.id));
  return note ? Response.json(note) : Response.json({ error: "not found" }, { status: 404 });
};

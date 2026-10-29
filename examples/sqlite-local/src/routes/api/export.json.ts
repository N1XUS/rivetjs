import { onGet } from "@rivetjs/router";
import { exportBookmarks, getDb } from "../../server/db.server.ts";

export const GET = onGet(
  () =>
    new Response(JSON.stringify(exportBookmarks(getDb())), {
      headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="bookmarks.json"' },
    }),
);

import { countBookmarks, openDb, seedBookmarks } from "../src/server/db.server.ts";

const db = openDb(process.env.DATABASE_PATH || "data/bookmarks.db");
if (countBookmarks(db) === 0) console.log("seeded", seedBookmarks(db));
else console.log("already has rows; delete the file to reseed");
db.close();

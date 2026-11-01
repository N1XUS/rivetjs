import { migrate, openDb } from "../src/server/db.server.ts";

const db = openDb(process.env.DATABASE_PATH || "data/auth.db");
console.log("migrations applied:", migrate(db, "migrations").length, "(openDb already ran pending ones)");
db.close();

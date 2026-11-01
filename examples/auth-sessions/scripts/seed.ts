// One demo account with an obviously fake password (development only): demo@example.com / rivet-dev-password.
import { openDb } from "../src/server/db.server.ts";
import { hashPassword } from "../src/server/password.server.ts";
import { createUser, findUserByEmail } from "../src/server/users.server.ts";

const db = openDb(process.env.DATABASE_PATH || "data/auth.db");
if (findUserByEmail(db, "demo@example.com")) console.log("demo@example.com already exists");
else console.log("created user", createUser(db, { email: "demo@example.com", name: "Demo", passwordHash: await hashPassword("rivet-dev-password") }));
db.close();

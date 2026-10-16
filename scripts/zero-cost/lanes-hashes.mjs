// Content hash of every file the ssr-bench build emits (its rendered lanes), sorted by path.
// Usage: node scripts/zero-cost/lanes-hashes.mjs <apps/ssr-bench/dist>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.argv[2];
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();
for (const file of files) console.log(`${relative(root, file)} ${createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12)}`);

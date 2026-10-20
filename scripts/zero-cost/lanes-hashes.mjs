// Content hash of every file the ssr-bench build emits (its rendered lanes), sorted by path.
// Usage: node scripts/zero-cost/lanes-hashes.mjs <apps/ssr-bench/dist>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.argv[2];
// Skipped: Finder's `.DS_Store`; `builds.json` (gzip / brotli sizes from the host's zlib, 2026-10-20) and Vite's
// `.vite/manifest.json` (machine-dependent on CI) — the artifact files they describe are hashed themselves.
const machine = (name) => name === ".DS_Store" || name === "builds.json" || name === "manifest.json";
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && !machine(entry.name))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();
for (const file of files) console.log(`${relative(root, file)} ${createHash("sha256").update(content(file)).digest("hex").slice(0, 12)}`);

/** File bytes, minus what depends on the machine: a Qwik `q-manifest.json` records `platform` (Node / OS / rollup versions). */
function content(file) {
  const bytes = readFileSync(file);
  if (!file.endsWith("q-manifest.json")) return bytes;
  const { platform, ...manifest } = JSON.parse(bytes.toString());
  return JSON.stringify(manifest);
}

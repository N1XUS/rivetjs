// Package build hook (`publishConfig.bundle`, scripts/package/build.ts): `node bundle.ts <out>` writes the docs data
// into the published package (`<out>/data/rivet.json`), built from the workspace's docs sites.
import { resolve } from "node:path";
import { buildData, writeData } from "./data.ts";

const out = process.argv[2];
if (!out) throw new Error("bundle.ts: output directory required");
const data = await buildData(resolve(import.meta.dirname, "../.."));
await writeData(data, resolve(out, "data", "rivet.json"));
console.log(`@rivetjs/mcp: bundled ${data.docs.length} docs, ${data.components.length} components`);

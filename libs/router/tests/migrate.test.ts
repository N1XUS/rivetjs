import { test } from "vitest";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { migrateServerExports } from "../build/migrate.ts";
import { serverExports } from "../server/module.ts";

const server = `import { db } from "../db.ts";
export async function load({ params }: { params: { id: string } }) {
  const load = 1; // a local: not the export
  return { id: params.id, n: load + db };
}
export const actions = { save: () => load({ params: { id: "x" } }) };
function entriesImpl() { return [{ id: "a" }]; }
export { entriesImpl as entries };
export function GET() { return new Response("ok"); }
export const serverGuard = () => undefined;
export const guard = () => undefined;
`;
const page = `import type { PageProps } from "@rivetjs/router";
type Data = Awaited<ReturnType<typeof import("./item.server.ts").load>>;
export default function Item({ data }: PageProps<Data>) { return data.id; }
`;

async function project() {
  const dir = await mkdtemp(join(tmpdir(), "rivet-migrate-"));
  await mkdir(join(dir, "src/routes"), { recursive: true });
  await writeFile(join(dir, "src/db.ts"), "export const db = 2;\n");
  await writeFile(join(dir, "src/routes/item.server.ts"), server);
  await writeFile(join(dir, "src/routes/item.tsx"), page);
  await writeFile(join(dir, "src/routes/other.ts"), "export const load = 1;\n");
  return dir;
}

test("migrate server-exports renames exports and their references, scope-aware; collisions are skipped", async () => {
  const dir = await project();
  try {
    const report = await migrateServerExports(dir, "src/routes");
    const out = report.changes.get(join(dir, "src/routes/item.server.ts"))!;
    assert.match(out, /export async function serverLoad\(/);
    assert.match(out, /const load = 1; \/\/ a local/);
    assert.match(out, /n: load \+ db/);
    assert.match(out, /export const serverActions = \{ save: \(\) => serverLoad\(/);
    assert.match(out, /export \{ entriesImpl as serverEntries \};/);
    assert.match(out, /export function onGet\(\)/);
    // `serverGuard` already exists: `guard` is left for the author.
    assert.match(out, /export const guard = /);
    assert.deepEqual(report.skipped, ["src/routes/item.server.ts: guard (`serverGuard` already exists)"]);
    assert.match(report.changes.get(join(dir, "src/routes/item.tsx"))!, /typeof import\("\.\/item\.server\.ts"\)\.serverLoad/);
    // Non-server modules are not touched.
    assert.ok(!report.changes.has(join(dir, "src/routes/other.ts")));
    // The migrated module still normalizes the same way at runtime (names only changed).
    const fn = () => 1;
    assert.deepEqual(Object.keys(serverExports({ serverLoad: fn, serverActions: {}, serverEntries: fn, onGet: fn }, true)).sort(), ["actions", "entries", "load", "onGet"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rivet CLI: --dry-run reports, default writes", async () => {
  const dir = await project();
  const bin = new URL("../cli/rivet.ts", import.meta.url).pathname;
  const run = (...args: string[]) => promisify(execFile)(process.execPath, [bin, ...args], { cwd: dir });
  try {
    const dry = await run("migrate", "server-exports", "--dry-run");
    assert.match(dry.stdout, /renamed src\/routes\/item\.server\.ts: load → serverLoad/);
    assert.match(dry.stdout, /would change 2 file\(s\)/);
    assert.equal(await readFile(join(dir, "src/routes/item.server.ts"), "utf8"), server);
    await run("migrate", "server-exports");
    assert.match(await readFile(join(dir, "src/routes/item.server.ts"), "utf8"), /export async function serverLoad/);
    await assert.rejects(run("nope"), /usage: rivet sync[\s\S]*rivet migrate server-exports/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

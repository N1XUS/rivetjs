import { test } from "vitest";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { migrateServerExports, migrateSource } from "../build/migrate.ts";
import { serverExports } from "../server/module.ts";
import * as wrappers from "../shared/server-exports.ts";

// Sibling `*.server.ts` with the former sibling names.
const server = `import { db } from "../db.ts";
export async function load({ params }: { params: { id: string } }) {
  const load = 1; // a local: not the export
  return { id: params.id, n: load + db };
}
export const actions = { save: () => load({ params: { id: "x" } }) };
function entriesImpl() { return [{ id: "a" }]; }
export { entriesImpl as entries };
export function GET() { return new Response("ok"); }
export const forms = 1;
export const guard = () => undefined;
`;
const page = `import type { PageProps } from "@rivetjs/router";
type Data = Awaited<ReturnType<typeof import("./item.server.ts").load>>;
export default function Item({ data }: PageProps<Data>) { return data.id; }
`;
// In-file magic names (page module).
const inline = `import { redirect, type PageProps, type RequestEvent } from "@rivetjs/router";
export async function serverLoad({ params }: RequestEvent) {
  return { id: params.id };
}
export const serverGuard = ({ locals }: RequestEvent) => (locals.user ? undefined : redirect("/login"));
export function onPost(this: void) { return arguments.length ? undefined : new Response("x"); }
export let serverHeaders = () => ({ "cache-control": "no-store" });
export default function Page({ data }: PageProps<typeof serverLoad>) { return <p>{data.id}</p>; }
`;

async function project() {
  const dir = await mkdtemp(join(tmpdir(), "rivet-migrate-"));
  await mkdir(join(dir, "src/routes"), { recursive: true });
  await writeFile(join(dir, "src/db.ts"), "export const db = 2;\n");
  await writeFile(join(dir, "src/routes/item.server.ts"), server);
  await writeFile(join(dir, "src/routes/item.tsx"), page);
  await writeFile(join(dir, "src/routes/inline.tsx"), inline);
  await writeFile(join(dir, "src/routes/other.ts"), "export const load = 1;\n");
  return dir;
}

test("migrate server-exports: sibling names → wrapper calls, references follow, collisions skipped", async () => {
  const dir = await project();
  try {
    const report = await migrateServerExports(dir, "src/routes");
    const out = report.changes.get(join(dir, "src/routes/item.server.ts"))!;
    assert.match(out, /^import \{ db \} from "\.\.\/db\.ts";\nimport \{ load, actions, entries, onGet, guard \} from "@rivetjs\/router";/);
    assert.match(out, /export const loader = load\(async \(\{ params \}: \{ params: \{ id: string \} \}\) => \{/);
    assert.match(out, /const load = 1; \/\/ a local/);
    assert.match(out, /n: load \+ db/);
    // `forms` is taken: the actions export becomes `formsExport`; the reference to the loader follows.
    assert.match(out, /export const formsExport = actions\(\{ save: \(\) => loader\(/);
    assert.match(out, /export const paths = entries\(entriesImpl\);/);
    assert.doesNotMatch(out, /export \{ entriesImpl/);
    assert.match(out, /export const GET = onGet\(\(\) => \{ return new Response\("ok"\); \}\);/);
    assert.match(out, /export const access = guard\(\(\) => undefined\);/);
    assert.match(report.changes.get(join(dir, "src/routes/item.tsx"))!, /typeof import\("\.\/item\.server\.ts"\)\.loader/);
    // A plain `.ts` (not a sibling) keeps `load`: only in-file magic names count there.
    assert.ok(!report.changes.has(join(dir, "src/routes/other.ts")));
    assert.deepEqual(report.skipped, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("migrate server-exports: in-file magic names; arrows unless the body needs `this` / `arguments`; let → const; import merged", async () => {
  const dir = await project();
  try {
    const report = await migrateServerExports(dir, "src/routes");
    const out = report.changes.get(join(dir, "src/routes/inline.tsx"))!;
    assert.match(out, /^import \{ redirect, type PageProps, type RequestEvent, load, guard, onPost, headers \} from "@rivetjs\/router";/);
    assert.match(out, /export const loader = load\(async \(\{ params \}: RequestEvent\) => \{\n  return \{ id: params\.id \};\n\}\);/);
    assert.match(out, /export const access = guard\(\(\{ locals \}: RequestEvent\) => \(locals\.user/);
    assert.match(out, /export const POST = onPost\(function POST\(this: void\) \{ return arguments\.length/);
    assert.match(out, /export const responseHeaders = headers\(\(\) => \(\{ "cache-control": "no-store" \}\)\);/);
    assert.match(out, /PageProps<typeof loader>/);
    assert.ok(report.renamed.includes("src/routes/inline.tsx: serverLoad → loader = load(…)"), report.renamed.join("\n"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("migrated modules normalize at runtime by tag", () => {
  const fn = () => 1;
  const module = { loader: wrappers.load(fn), forms: wrappers.actions({ save: fn }), paths: wrappers.entries(() => []), GET: wrappers.onGet(() => undefined) };
  assert.deepEqual(Object.keys(serverExports(module, "x.server.ts", true)).sort(), ["actions", "entries", "load", "onGet"]);
});

test("migrateSource: one module on its own (docs snippets); a local named like a wrapper gets an aliased import", () => {
  const { text, skipped } = migrateSource(ts, `const load = 2;\nexport const serverLoad = () => load;\n`, "src/routes/x.tsx");
  assert.deepEqual(skipped, []);
  assert.equal(text, `import { load as rivetLoad } from "@rivetjs/router";\nconst load = 2;\nexport const loader = rivetLoad(() => load);\n`);
});

test("rivet CLI: --dry-run reports, default writes", async () => {
  const dir = await project();
  const bin = new URL("../cli/rivet.ts", import.meta.url).pathname;
  const run = (...args: string[]) => promisify(execFile)(process.execPath, [bin, ...args], { cwd: dir });
  try {
    const dry = await run("migrate", "server-exports", "--dry-run");
    assert.match(dry.stdout, /renamed src\/routes\/item\.server\.ts: load → loader = load\(…\)/);
    assert.match(dry.stdout, /would change 3 file\(s\)/);
    assert.equal(await readFile(join(dir, "src/routes/item.server.ts"), "utf8"), server);
    await run("migrate", "server-exports");
    assert.match(await readFile(join(dir, "src/routes/item.server.ts"), "utf8"), /export const loader = load\(/);
    await assert.rejects(run("nope"), /usage: rivet sync[\s\S]*rivet migrate server-exports/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

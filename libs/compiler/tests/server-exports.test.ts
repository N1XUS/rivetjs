import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, moduleFacts } from "../index.ts";

const dom = (source: string, extra: object = {}) => compile(source, { target: "dom", filename: "route.tsx", serverExports: true, ...extra });
const server = (source: string) => compile(source, { target: "server", filename: "route.tsx", serverExports: true });
const messages = (r: { diagnostics: { message: string }[] }) => r.diagnostics.map((d) => d.message).join("\n");

const route = `import { db } from "../db.server.ts";
import { readFile } from "node:fs/promises";
import { format, shout } from "./util.ts";
import type { RequestEvent } from "@rivetjs/router";

const table = "posts";
async function query(id: string) { return db.get(table, id, await readFile("x")); }

export async function serverLoad({ params }: RequestEvent) {
  return { post: await query(params.id), title: shout(params.id) };
}
export const serverGuard = () => undefined;
export const serverActions = { save: async () => ({ ok: true }) };
export function onGet() {}
export const onPost = async () => new Response("ok");

export const prerender = true;
export default function Page({ data }: { data: () => { title: string } }) {
  return <h1>{format(data().title)}</h1>;
}
`;

test("DOM target removes server exports and code/imports only they use; positions are kept", () => {
  const r = dom(route);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["serverLoad", "serverGuard", "serverActions", "onGet", "onPost"]);
  assert.deepEqual(r.serverImports, ["../db.server.ts", "node:fs/promises"]);
  for (const gone of ["db.server", "node:fs", "readFile", "query", "serverLoad", "serverGuard", "serverActions", "onGet", "onPost", "shout", "posts"])
    assert.ok(!r.code.includes(gone), gone + " in:\n" + r.code);
  for (const kept of ["format", "./util.ts", "prerender"]) assert.ok(r.code.includes(kept), kept);
});

test("server target keeps everything and reports the same names", () => {
  const r = server(route);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["serverLoad", "serverGuard", "serverActions", "onGet", "onPost"]);
  for (const kept of ["db.server", "serverLoad", "onPost", "query"]) assert.ok(r.code.includes(kept), kept);
});

test("without the option output is unchanged and carries no server fields", () => {
  const plain = compile(route, { target: "dom", filename: "route.tsx" });
  assert.equal(plain.serverExports, undefined);
  assert.ok(plain.code.includes("serverLoad"));
  const page = "export default function P() { return <p>hi</p>; }";
  const a = compile(page, { target: "dom", filename: "p.tsx" });
  const b = dom(page);
  assert.equal(b.code, a.code);
  assert.deepEqual(b.serverExports, []);
});

test("diagnostic line numbers match the original source after removal", () => {
  const source = `export function serverLoad() {\n  return 1;\n}\n\nexport default function P() { return <p>{undefinedThing <}</p>; }`;
  const original = compile(source, { target: "dom", filename: "route.tsx" }).diagnostics.map((d) => d.line);
  assert.deepEqual(
    dom(source).diagnostics.map((d) => d.line),
    original,
  );
});

test("partial imports keep the browser specifiers; export lists and renames", () => {
  const r = dom(`import def, { a, b as bee, c } from "./m.ts";
    import * as ns from "./n.ts";
    function load() { return a + bee + ns.x; }
    export { load as serverLoad, helper };
    function helper() { return c; }
    export default function P() { return <p>{def}{helper()}</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["serverLoad"]);
  assert.match(r.code, /import def,\s*\{\s*c\s*\}\s*from\s*"\.\/m\.ts"/);
  assert.doesNotMatch(r.code, /\bbee\b|\.\/n\.ts|function load/);
  assert.match(r.code, /export\s*\{\s*helper\s*\}/);
});

test("type references do not keep server code; re-exports of server names are removed", () => {
  const r = dom(`import { db } from "./db.server.ts";
    export async function serverLoad() { return { n: await db.count() }; }
    export { onGet } from "./handlers.server.ts";
    type Data = Awaited<ReturnType<typeof serverLoad>>;
    export default function P({ data }: { data: () => Data }) { return <p>{data().n}</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["serverLoad", "onGet"]);
  assert.deepEqual(r.serverImports, ["./handlers.server.ts", "./db.server.ts"]);
  assert.doesNotMatch(r.code, /server\.ts|serverLoad|db\.count/);
});

test("errors: browser code reaching server code, mixed exports, export *, server-only imports, JSX in resume", () => {
  for (const target of ["server", "dom"] as const) {
    const run = (source: string, resume = false) =>
      messages(compile(source, { target, filename: "route.tsx", serverExports: true, ...(resume ? { resume: { module: "r.tsx" } } : {}) }));
    assert.match(
      run(`export function serverLoad() { return 1; }
           export default function P() { return <p>{serverLoad()}</p>; }`),
      /`serverLoad` is server-only .* line 2/,
    );
    assert.match(run(`export const serverLoad = 1, other = 2;`), /own export statement/);
    assert.match(run(`export * from "./x.ts"; export const onGet = () => {};`), /export \*/);
    assert.match(
      run(`import { secret } from "./keys.server.ts";
           export const serverLoad = () => secret;
           export default function P() { return <p>{secret}</p>; }`),
      /`secret` \(from "\.\/keys\.server\.ts"\) is used by browser code/,
    );
    assert.match(run(`export function serverLoad() { return <b />; } export default function P() { return <p />; }`, true), /cannot render JSX/);
  }
});

test("server-name rules: server[A-Z] prefix and the handler list only", () => {
  const r = dom(`export const serverX = 1; export const servers = 2; export const onDelete = 3; export const onClick = 4; export const prerender = true;`);
  assert.deepEqual(r.serverExports, ["serverX", "onDelete"]);
  assert.match(r.code, /servers/);
  assert.match(r.code, /onClick/);
});

test("onOptions (CORS preflight) is a server handler: stripped from the browser build", () => {
  const r = dom(`import { cors } from "./cors.server.ts";\nexport const onOptions = (event: any) => cors(event);\nexport default () => <p>x</p>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.serverExports, ["onOptions"]);
  assert.deepEqual(r.serverImports, ["./cors.server.ts"]);
  assert.doesNotMatch(r.code, /onOptions|cors/);
});

test("moduleFacts with serverExports reports the browser graph", () => {
  const facts = moduleFacts(route, "route.tsx", { serverExports: true });
  assert.deepEqual(facts.serverExports, ["serverLoad", "serverGuard", "serverActions", "onGet", "onPost"]);
  assert.deepEqual(facts.serverImports, ["../db.server.ts", "node:fs/promises"]);
  assert.deepEqual(facts.serverErrors, []);
  const from = [...facts.imports.values()].map((i) => i.from);
  assert.ok(!from.includes("../db.server.ts") && from.includes("./util.ts"), from.join());
  const bad = moduleFacts(`export const serverLoad = 1, x = 2;`, "r.tsx", { serverExports: true });
  assert.match(bad.serverErrors![0]!.message, /own export statement/);
  assert.equal(moduleFacts(route, "route.tsx").serverExports, undefined);
});

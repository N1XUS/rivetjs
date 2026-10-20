import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, moduleFacts } from "../index.ts";

// Server exports are wrapper calls (`load(…)`, `onGet(…)` from `@rivetjs/router`; spec
// docs/design/specs/2026-10-20-server-exports-design.md): names are free, the wrapper decides.
const dom = (source: string, extra: object = {}) => compile(source, { target: "dom", filename: "route.tsx", serverExports: true, ...extra });
const server = (source: string) => compile(source, { target: "server", filename: "route.tsx", serverExports: true });
const messages = (r: { diagnostics: { message: string }[] }) => r.diagnostics.map((d) => d.message).join("\n");

const route = `import { db } from "../db.server.ts";
import { readFile } from "node:fs/promises";
import { format, shout } from "./util.ts";
import type { RequestEvent } from "@rivetjs/router";
import { load, guard, actions, onGet, onPost } from "@rivetjs/router";

const table = "posts";
async function query(id: string) { return db.get(table, id, await readFile("x")); }

export const loader = load(async ({ params }: RequestEvent) => {
  return { post: await query(params.id), title: shout(params.id) };
});
export const access = guard(() => undefined);
export const forms = actions({ save: async () => ({ ok: true }) });
export const GET = onGet(() => undefined);
export const POST = onPost(async () => new Response("ok"));

export const prerender = true;
export default function Page({ data }: { data: () => { title: string } }) {
  return <h1>{format(data().title)}</h1>;
}
`;
const NAMES = ["loader", "access", "forms", "GET", "POST"];
const KINDS = ["load", "guard", "actions", "onGet", "onPost"];

test("DOM target removes server exports, the wrapper import and code/imports only they use; positions are kept", () => {
  const r = dom(route);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, NAMES);
  assert.deepEqual(r.serverKinds, KINDS);
  assert.deepEqual(r.serverImports, ["../db.server.ts", "node:fs/promises", "@rivetjs/router"]);
  for (const gone of ["db.server", "node:fs", "readFile", "query", "loader", "access", "forms", "GET", "POST", "shout", "posts", "@rivetjs/router"])
    assert.ok(!r.code.includes(gone), gone + " in:\n" + r.code);
  for (const kept of ["format", "./util.ts", "prerender"]) assert.ok(r.code.includes(kept), kept);
});

test("server target keeps everything and reports the same names and kinds", () => {
  const r = server(route);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, NAMES);
  assert.deepEqual(r.serverKinds, KINDS);
  for (const kept of ["db.server", "loader", "onPost", "query"]) assert.ok(r.code.includes(kept), kept);
});

test("without the option output is unchanged and carries no server fields", () => {
  const plain = compile(route, { target: "dom", filename: "route.tsx" });
  assert.equal(plain.serverExports, undefined);
  assert.equal(plain.serverKinds, undefined);
  assert.ok(plain.code.includes("loader"));
  const page = "export default function P() { return <p>hi</p>; }";
  const a = compile(page, { target: "dom", filename: "p.tsx" });
  const b = dom(page);
  assert.equal(b.code, a.code);
  assert.deepEqual(b.serverExports, []);
  assert.deepEqual(b.serverKinds, []);
});

test("export names are free; aliases and namespace imports of the wrappers are followed", () => {
  const r = dom(`import { onGet as get, load as l } from "@rivetjs/router";
    import * as router from "@rivetjs/router";
    export const getData = get(() => Response.json({ ok: true }));
    export const anything = l(() => 1);
    export const gate = router.guard(() => undefined);
    export const redirectTo = router.redirect;
    export default function P() { return <p>x</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["getData", "anything", "gate"]);
  assert.deepEqual(r.serverKinds, ["onGet", "load", "guard"]);
  assert.doesNotMatch(r.code, /getData|anything|gate\b/);
  assert.match(r.code, /redirectTo/);
});

test("a call of a same-named function that is not the router wrapper is not a server export", () => {
  const r = dom(`import { load } from "./my-loader.ts";
    export const onGetLike = load(() => 1);
    export default function P() { return <p>x</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, []);
  assert.match(r.code, /onGetLike/);
});

test("diagnostic line numbers match the original source after removal", () => {
  const source = `import { load } from "@rivetjs/router";\nexport const loader = load(() => {\n  return 1;\n});\n\nexport default function P() { return <p>{undefinedThing <}</p>; }`;
  const original = compile(source, { target: "dom", filename: "route.tsx" }).diagnostics.map((d) => d.line);
  assert.deepEqual(
    dom(source).diagnostics.map((d) => d.line),
    original,
  );
});

test("partial imports keep the browser specifiers; export lists and renames", () => {
  const r = dom(`import def, { a, b as bee, c } from "./m.ts";
    import * as ns from "./n.ts";
    import { load } from "@rivetjs/router";
    const loader = load(() => a + bee + ns.x);
    export { loader as data, helper };
    function helper() { return c; }
    export default function P() { return <p>{def}{helper()}</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["data"]);
  assert.deepEqual(r.serverKinds, ["load"]);
  assert.match(r.code, /import def,\s*\{\s*c\s*\}\s*from\s*"\.\/m\.ts"/);
  assert.doesNotMatch(r.code, /\bbee\b|\.\/n\.ts|loader|@rivetjs\/router/);
  assert.match(r.code, /export\s*\{\s*helper\s*\}/);
});

test("type references do not keep server code; re-exports from server-only modules are removed (kind ?)", () => {
  const r = dom(`import { db } from "./db.server.ts";
    import { load } from "@rivetjs/router";
    export const loader = load(async () => ({ n: await db.count() }));
    export { GET } from "./handlers.server.ts";
    export { helper } from "./helpers.ts";
    type Data = Awaited<ReturnType<typeof loader>>;
    export default function P({ data }: { data: () => Data }) { return <p>{data().n}</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, ["loader", "GET"]);
  assert.deepEqual(r.serverKinds, ["load", "?"]);
  assert.deepEqual(r.serverImports, ["./handlers.server.ts", "./db.server.ts", "@rivetjs/router"]);
  assert.doesNotMatch(r.code, /server\.ts|loader|db\.count/);
  assert.match(r.code, /helpers\.ts/);
});

test("a non-exported server binding is server code too", () => {
  const r = dom(`import { secret } from "./keys.server.ts";
    import { load } from "@rivetjs/router";
    const unused = load(() => secret);
    export default function P() { return <p>x</p>; }`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, []);
  assert.doesNotMatch(r.code, /secret|unused|keys\.server/);
});

test("errors: browser code reaching server code, mixed exports, export *, server-only imports, JSX in resume", () => {
  for (const target of ["server", "dom"] as const) {
    const run = (source: string, resume = false) =>
      messages(
        compile(`import { load, onGet } from "@rivetjs/router";\n${source}`, {
          target,
          filename: "route.tsx",
          serverExports: true,
          ...(resume ? { resume: { module: "r.tsx" } } : {}),
        }),
      );
    assert.match(
      run(`export const loader = load(() => 1);
           export default function P() { return <p>{String(loader)}</p>; }`),
      /`loader` is server-only .* line 3/,
    );
    assert.match(run(`export const loader = load(() => 1), other = 2;`), /own export statement/);
    assert.match(run(`export * from "./x.ts"; export const GET = onGet(() => undefined);`), /export \*/);
    assert.match(
      run(`import { secret } from "./keys.server.ts";
           export const loader = load(() => secret);
           export default function P() { return <p>{secret}</p>; }`),
      /`secret` \(from "\.\/keys\.server\.ts"\) is used by browser code/,
    );
    assert.match(run(`export const loader = load(() => <b />); export default function P() { return <p />; }`, true), /cannot render JSX/);
  }
});

test("RV3007: a wrapper anywhere but the initializer of a module-scope const", () => {
  for (const source of [
    `export default load(() => 1);`,
    `export let loader = load(() => 1);`,
    `export const loader = Math.random() > 0.5 ? load(() => 1) : undefined;`,
    `export function make() { return load(() => 1); }`,
    `const f = load; export const loader = f(() => 1);`,
  ]) {
    const r = dom(`import { load } from "@rivetjs/router";\n${source}`);
    assert.match(messages(r), /Server export wrapper `load` must initialize a module-scope `const`/, source);
    assert.equal(r.diagnostics[0]!.code, "RV3007");
  }
});

test("RV3007: two exports of one kind name both; one value under two names is fine", () => {
  const r = dom(`import { onGet, onPost } from "@rivetjs/router";
    export const a = onGet(() => undefined);
    export const b = onGet(() => undefined);
    export const c = onPost(() => undefined);`);
  assert.match(messages(r), /Duplicate server export: `a` and `b` are both `onGet\(…\)`; keep one/);
  const same = dom(`import { load } from "@rivetjs/router";
    export const loader = load(() => 1);
    export { loader as alias };`);
  assert.equal(messages(same), "");
  assert.deepEqual(same.serverExports, ["loader", "alias"]);
});

test("RV3010: an untagged export with a former magic name, with the wrapper fix", () => {
  for (const [source, fix] of [
    [`export const onGet = () => new Response("x");`, /`export const GET = onGet\(\(event\) => …\)` with `import \{ onGet \} from "@rivetjs\/router"`/],
    [`export async function serverLoad() { return 1; }`, /`export const loader = load\(\(event\) => …\)`/],
    [`export const serverActions = { save: () => 1 };`, /`export const forms = actions\(\{ name: \(event\) => … \}\)`/],
    [`const x = () => 1; export { x as onPost };`, /`export const POST = onPost/],
    [`export { onRequest } from "./helpers.ts";`, /`export const middleware = onRequest/],
  ] as const) {
    const r = dom(source);
    assert.match(messages(r), /^Untagged server export `/, source);
    assert.match(messages(r), fix, source);
    assert.equal(r.diagnostics[0]!.code, "RV3010", source);
  }
  // Wrapped under the old name (aliased import) is fine; other names never trigger it.
  assert.equal(messages(dom(`import { onGet as get } from "@rivetjs/router"; export const onGet = get(() => undefined);`)), "");
  assert.equal(messages(dom(`export const onClick = () => 1; export const servers = 2; export const load = 3;`)), "");
});

test("the server-name prefix rule is gone: serverX / onDelete without a wrapper are ordinary exports (only magic names error)", () => {
  const r = dom(`export const serverX = 1; export const prerender = true; export default () => <p>x</p>;`);
  assert.equal(messages(r), "");
  assert.deepEqual(r.serverExports, []);
  assert.match(r.code, /serverX/);
});

test("onOptions (CORS preflight) is a server handler: stripped from the browser build", () => {
  const r = dom(
    `import { onOptions } from "@rivetjs/router";\nimport { cors } from "./cors.server.ts";\nexport const OPTIONS = onOptions((event) => cors(event));\nexport default () => <p>x</p>;`,
  );
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.serverExports, ["OPTIONS"]);
  assert.deepEqual(r.serverKinds, ["onOptions"]);
  assert.deepEqual(r.serverImports, ["@rivetjs/router", "./cors.server.ts"]);
  assert.doesNotMatch(r.code, /onOptions|cors|OPTIONS/);
});

test("moduleFacts with serverExports reports the browser graph and kinds", () => {
  const facts = moduleFacts(route, "route.tsx", { serverExports: true });
  assert.deepEqual(facts.serverExports, NAMES);
  assert.deepEqual(facts.serverKinds, KINDS);
  assert.deepEqual(facts.serverImports, ["../db.server.ts", "node:fs/promises", "@rivetjs/router"]);
  assert.deepEqual(facts.serverErrors, []);
  const from = [...facts.imports.values()].map((i) => i.from);
  assert.ok(!from.includes("../db.server.ts") && from.includes("./util.ts"), from.join());
  const bad = moduleFacts(`import { load } from "@rivetjs/router"; export const loader = load(() => 1), x = 2;`, "r.tsx", { serverExports: true });
  assert.match(bad.serverErrors![0]!.message, /own export statement/);
  const untagged = moduleFacts(`export const onGet = () => new Response("x");`, "r.ts", { serverExports: true });
  assert.match(untagged.serverErrors![0]!.message, /^Untagged server export `onGet`/);
  assert.equal(moduleFacts(route, "route.tsx").serverExports, undefined);
});

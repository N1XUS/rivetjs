// Function Bridge T13 (C11): literal store paths of captured code mark the store. A `const` store from `createStore`
// (`@rivetjs/reactivity/store`) that a resumed site captures, whose every reference is the first argument of `read` /
// `write` / `at` with a literal path, gets `_rStorePaths(createStore(…), [paths])` on the server; any other reference
// (a dynamic path, a whole read / write, the store passed or aliased) keeps the whole store (no wrapper). Views
// (`at(store, "p")`) are followed recursively (fix round 1): any other use of a view keeps the whole store too.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

type Out = { code: string; symbols: { id: string; source: string }[] };
const run = (source: string, target: "server" | "dom") => compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as Out;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const server = (handler: string) =>
  (
    compile(
      `import { createStore, read, write } from "@rivetjs/reactivity/store";
export function Page() { const store = createStore({ count: 0, blob: "B" }); const key = "count";
  return <button onClick={() => ${handler}}>{read(store, "count")}</button>; }`,
      { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
    ) as { code: string }
  ).code;

test("literal paths mark the store", () => {
  const code = flat(server('write(store, "count", (c: number) => c + 1)'));
  assert.match(code, /const store = __rivetR_storePaths\(createStore\(\{ count: 0, blob: "B" \}\), \["count"\]\)/);
  assert.match(code, /import \{[^}]*_rStorePaths as __rivetR_storePaths/);
});

test("a dynamic path keeps the whole store", () => {
  assert.doesNotMatch(server("write(store, key, (c: number) => c + 1)"), /__rivetR_storePaths/);
});

const page = (body: string, extra = "") => `import { createStore, read, write, at } from "@rivetjs/reactivity/store";
${extra}
export function Page() {
  const store = createStore({ count: 0, user: { name: "a", bio: "b" }, list: [1, 2] });
  ${body}
}`;
const paths = (source: string) => {
  const list = /__rivetR_storePaths\(createStore\([^]*?\), (\[[^\]]*\])\)/.exec(flat(run(source, "server").code))?.[1];
  return list === undefined ? undefined : (JSON.parse(list) as string[]);
};

test("paths of every site and of server-only code: union, sorted, deduped", () => {
  const source = page(`return <div>
    <button onClick={() => write(store, "user.name", "x")}>{read(store, "count")}</button>
    <i onClick={() => write(store, \`count\`, 1)}>{read(store, "list.1")}</i>
    <b>{read(store, "count")}</b>
  </div>;`);
  assert.deepEqual(paths(source), ["count", "list.1", "user.name"]);
});

test("at(store, path): a view's literal reads are paths below it", () => {
  const source = page(`const row = at(store, "user");
  return <button onClick={() => write(row, "name", "x")}>{read(store, "count")}</button>;`);
  assert.deepEqual(paths(source), ["count", "user.name"]);
});

test("a captured view (and a view of a view) marks its store with the view's paths", () => {
  assert.deepEqual(paths(page('const row = at(store, "list.1"); return <button onClick={() => write(row, "", 3 as never)}>x</button>;')), ["list.1"]);
  assert.deepEqual(paths(page('const u = at(store, "user"); const n = at(u, "name"); return <button onClick={() => write(n, "", "x" as never)}>x</button>;')), [
    "user.name",
  ]);
  // A whole read / write or a dynamic path below a view ships the view's subtree.
  assert.deepEqual(paths(page('const u = at(store, "user"); return <button onClick={() => console.log(read(u))}>x</button>;')), ["user"]);
  assert.deepEqual(paths(page('const u = at(store, "user"); const k = "name"; return <button onClick={() => console.log(read(u, k as never))}>x</button>;')), [
    "user",
  ]);
  // Inline views.
  assert.deepEqual(paths(page('return <button onClick={() => console.log(read(at(store, "user"), "bio"))}>x</button>;')), ["user.bio"]);
});

test("a dynamic at below a view ships the view's subtree and clamps reads below it (fix round 2)", () => {
  const extra = "";
  assert.deepEqual(
    paths(
      page(
        'const u = at(store, "user"); const k = "bio" as string; const w = at(u, k as never); return <button onClick={() => console.log(read(w, "name" as never))}>x</button>;',
        extra,
      ),
    ),
    ["user"],
  );
  assert.deepEqual(
    paths(page('const k = "bio" as string; return <button onClick={() => console.log(read(at(at(store, "user"), k as never), "name" as never))}>x</button>;')),
    ["user"],
  );
  // A view of the dynamic view, and a whole write through it, stay inside the subtree too.
  assert.deepEqual(
    paths(
      page(
        'const u = at(store, "user"); const k = "bio" as string; const w = at(u, k as never); const x = at(w, "a" as never); return <button onClick={() => write(x, "b" as never, 1 as never)}>x</button>;',
      ),
    ),
    ["user"],
  );
  // Its root store read through `.s` still keeps the whole store.
  assert.doesNotMatch(
    run(
      page(
        'const u = at(store, "user"); const k = "bio" as string; const w = at(u, k as never); return <button onClick={() => console.log(read(w.s as never, "list.1"))}>x</button>;',
      ),
      "server",
    ).code,
    /__rivetR_storePaths/,
  );
});

// Fix round 1 (review F1): a view holds its root store (`StoreView.s`): any use of it but `read` / `write` / `at`.
for (const [name, body] of [
  ["a view's root member", 'const u = at(store, "user"); return <button onClick={() => console.log(read(u.s as never, "list.1"))}>x</button>;'],
  ["a view's prefix member", 'const u = at(store, "user"); return <button onClick={() => console.log(u.p)}>x</button>;'],
  ["a view passed to a function", 'const u = at(store, "user"); return <button onClick={() => console.log(u)}>x</button>;'],
  ["a view aliased", 'const u = at(store, "user"); const w = u; return <button onClick={() => write(w, "name", "x")}>x</button>;'],
  ["a let view", 'let u = at(store, "user"); return <button onClick={() => write(u, "name", "x")}>x</button>;'],
  ["a view as a child prop", 'const u = at(store, "user"); return <Child store={u} onClick={() => write(u, "name", "x")} />;'],
  ["an inline view passed on", 'return <button onClick={() => console.log(at(store, "user"))}>x</button>;'],
  ["an empty root path", 'return <button onClick={() => console.log(read(store, ""))}>x</button>;'],
] as const) {
  test(`${name} keeps the whole store`, () => {
    const code = run(
      page(body, "function Child(props: { store: unknown; onClick: () => void }) { return <button onClick={props.onClick}>x</button>; }"),
      "server",
    ).code;
    assert.doesNotMatch(code, /__rivetR_storePaths/, code);
  });
}

test("parentheses and TS casts around the store argument are looked through (review F3)", () => {
  assert.deepEqual(paths(page('return <button onClick={() => write((store), "count", 1)}>{read(store as never, "list.0")}</button>;')), ["count", "list.0"]);
  assert.deepEqual(paths(page('const u = (at(store!, "user") satisfies object); return <button onClick={() => write(u, "name", "x")}>x</button>;')), [
    "user.name",
  ]);
});

test("namespace-import calls resolve (review F4)", () => {
  const source = `import * as st from "@rivetjs/reactivity/store";
export function Page() { const store = st.createStore({ count: 0, user: { name: "a" } }); const u = st.at(store, "user");
  return <button onClick={() => st.write(u, "name", "x")}>{st.read(store, "count")}</button>; }`;
  assert.match(flat(run(source, "server").code), /const store = __rivetR_storePaths\(st\.createStore\([^]*?\), \["count", "user\.name"\]\)/);
  const other = source.replace('import * as st from "@rivetjs/reactivity/store";', 'import * as st from "./other";');
  assert.doesNotMatch(run(other, "server").code, /__rivetR_storePaths/);
});

for (const [name, body] of [
  ["a whole read", 'return <button onClick={() => console.log(read(store))}>{read(store, "count")}</button>;'],
  ["a whole write", 'return <button onClick={() => write(store, { count: 1 } as never)}>{read(store, "count")}</button>;'],
  ["a template path with a substitution", 'const k = "count"; return <button onClick={() => write(store, `${k}`, 1)}>x</button>;'],
  ["the store passed to a function", 'return <button onClick={() => console.log(store)}>{read(store, "count")}</button>;'],
  ["the store aliased", 'const other = store; return <button onClick={() => write(other, "count", 1)}>{read(store, "count")}</button>;'],
  ["a member of the store", 'return <button onClick={() => store.v.set({} as never)}>{read(store, "count")}</button>;'],
  ["the store as a prop", 'return <Child store={store} onClick={() => write(store, "count", 1)} />;'],
] as const) {
  test(`${name} keeps the whole store`, () => {
    const code = run(
      page(body, "function Child(props: { store: unknown; onClick: () => void }) { return <button onClick={props.onClick}>x</button>; }"),
      "server",
    ).code;
    assert.doesNotMatch(code, /__rivetR_storePaths/, code);
  });
}

test("a store no site captures is not marked (a binding reading it captures it)", () => {
  assert.doesNotMatch(run(page('const n = read(store, "count"); return <p>{n}</p>;'), "server").code, /__rivetR_storePaths/);
  assert.deepEqual(paths(page('return <p>{read(store, "count")}</p>;')), ["count"]);
});

test("a store from another createStore (not @rivetjs/reactivity/store) is not marked", () => {
  const source = `import { createStore } from "./other";
import { read, write } from "@rivetjs/reactivity/store";
export function Page() { const store = createStore({ count: 0 });
  return <button onClick={() => write(store, "count", 1)}>{read(store, "count")}</button>; }`;
  assert.doesNotMatch(run(source, "server").code, /__rivetR_storePaths/);
});

test("aliased imports count; a let store is not marked", () => {
  const aliased = `import { createStore as make, read as get, write as put } from "@rivetjs/reactivity/store";
export function Page() { const store = make({ count: 0, blob: "B" });
  return <button onClick={() => put(store, "count", 1)}>{get(store, "count")}</button>; }`;
  assert.match(flat(run(aliased, "server").code), /const store = __rivetR_storePaths\(make\(\{ count: 0, blob: "B" \}\), \["count"\]\)/);
  const mutable = aliased.replace("const store", "let store");
  assert.doesNotMatch(run(mutable, "server").code, /__rivetR_storePaths/);
});

test("the DOM target and the symbols are unchanged; the store is a whole capture (never `_rMember`-narrowed)", () => {
  const source = page('return <button onClick={() => write(store, "count", 1)}>{read(store, "count")}</button>;');
  const dom = run(source, "dom");
  assert.doesNotMatch(dom.code, /storePaths/);
  assert.ok(dom.symbols.every((s) => !/storePaths|__rivetMembers/.test(s.source)));
  const code = run(source, "server").code;
  assert.doesNotMatch(code, /__rivetR_member\(store/);
  assert.match(code, /__rivetR_on\([^)]*\[store\]/);
});

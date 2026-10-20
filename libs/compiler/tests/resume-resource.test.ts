// RESOURCE-COMPILER (2026-10-20, spec docs/design/specs/2026-10-20-resource-design.md §4): every captured
// `const r = resource(…)` (from `@rivetjs/runtime/dom`, aliased imports included) is a recipe on the server
// (`__rivetR_fn(id, resource(…), caps)`), not only the inline-arrow form: a module / imported fetcher by name, a local
// const fetcher, `initialValue` from props, `ssr: false`, resources in `For` rows and `Show` branches, a resource read in
// a handler only. A local function named `resource` and an uncaptured resource stay plain. The forms that cannot resume
// warn RV2016 in resume mode (code still emitted); the DOM main module carries no recipe. Browser round trip:
// libs/runtime/tests/resource-resume.test.ts ("forms").
import { test } from "vitest";
import assert from "node:assert/strict";
import { check, compile } from "../index.ts";

const resume = { module: "src/r.tsx" };
const source = `import { signal } from "@rivetjs/reactivity";
import { For, Show, resource, resource as res } from "@rivetjs/runtime/dom";
import { loadUser } from "./api.ts";
async function fetchUser(key: unknown) { return "u" + key; }
export function Named() {
  const r = resource(fetchUser);
  return <b>{r()}</b>;
}
export function Imported() {
  const id = signal(1);
  const r = resource(() => id(), loadUser);
  return <b>{r()}</b>;
}
export function Local(props: { init: string }) {
  const id = signal(1);
  const f = (key: number) => loadUser(key);
  const r = resource(id, f, { initialValue: props.init });
  return <b>{r()}</b>;
}
export function Aliased() {
  const r = res(fetchUser, { ssr: false });
  return <button onClick={() => console.log(r())}>x</button>;
}
export function Rows(props: { xs: () => number[]; on: () => boolean }) {
  return (
    <ul>
      <For each={props.xs()}>{(x) => { const row = resource(() => x(), fetchUser); return <li>{row()}</li>; }}</For>
      <Show when={props.on()}>{() => { const branch = resource(fetchUser); return <i>{branch()}</i>; }}</Show>
    </ul>
  );
}
export function Unused() {
  const quiet = resource(fetchUser);
  return <p>static</p>;
}`;

const recipe = (component: string, call: string) =>
  new RegExp(`= __rivetR_fn\\("src/r\\.tsx#${component}\\$\\w+", ${call.replace(/[()[\]{}.$*+?|\\]/g, "\\$&")}`);

test("server: captured resources are recipes whatever their arguments", () => {
  const server = compile(source, { target: "server", filename: "r.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(server.warnings ?? [], []);
  assert.match(server.code, recipe("Named", "resource(fetchUser), [])"));
  assert.match(
    server.code,
    /const r = __rivetR_fn\("src\/r\.tsx#Imported\$\w+", resource\(__rivetR_fn\("src\/r\.tsx#Imported\$\w+", \(\) => id\(\), \[id\]\), loadUser\), \[id\]\)/,
  );
  assert.match(
    server.code,
    /const r = __rivetR_fn\("src\/r\.tsx#Local\$\w+", resource\(id, f, \{ initialValue: props\.init \}\), \[\s*id,\s*f,\s*props\s*\]\)/,
  );
  assert.match(server.code, recipe("Aliased", "res(fetchUser, { ssr: false }), [])"));
  assert.match(
    server.code,
    /const row = __rivetR_fn\("src\/r\.tsx#Rows\$\w+", resource\(__rivetR_fn\("src\/r\.tsx#Rows\$\w+", \(\) => x\(\), \[x\]\), fetchUser\), \[x\]\)/,
  );
  assert.match(server.code, recipe("Rows", "resource(fetchUser), [])"));
  // Module functions / imports in a recipe resume by reference.
  assert.match(server.code, /__rivetR_mod\(\(\(\) => fetchUser\), "src\/r\.tsx#fetchUser\$l\$\w+\$ref"\)/);
  assert.match(server.code, /__rivetR_mod\(\(\(\) => loadUser\), "src\/api\.ts#loadUser\$\w+\$ref", 1\)/);
  // Not captured by any site: nothing to resume.
  assert.match(server.code, /const quiet = resource\(fetchUser\);/);
  const symbols = server.symbols ?? [];
  const local = symbols.find((s) => s.kind === "fn" && s.source.includes("initialValue"));
  assert.deepEqual(local?.captures, ["id", "f", "props"]);
  assert.ok(
    symbols.some((s) => s.kind === "fn" && s.id.startsWith("src/r.tsx#Local$") && s.source.includes("loadUser(key)")),
    "the local fetcher is its own recipe",
  );
});

test("DOM: the main module carries no recipe; both targets name the same symbols", () => {
  const dom = compile(source, { target: "dom", filename: "r.tsx", resume });
  const server = compile(source, { target: "server", filename: "r.tsx", resume });
  assert.deepEqual(dom.diagnostics, []);
  assert.doesNotMatch(dom.code, /__rivetR_|_rFn/);
  assert.match(dom.code, /const r = resource\(fetchUser\);/);
  const ids = (r: typeof dom) => (r.symbols ?? []).map((s) => s.id).sort();
  assert.deepEqual(ids(dom), ids(server));
});

test("a local function named `resource` is not the runtime's", () => {
  const shadow = `import { signal } from "@rivetjs/reactivity";
function resource(f: () => number) { return f; }
export function A() {
  const n = signal(1);
  const g = () => n();
  const r = resource(g);
  return <b>{r()}</b>;
}`;
  const server = compile(shadow, { target: "server", filename: "r.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.doesNotMatch(server.code, /const r = __rivetR_fn/);
});

const unresumable = `import { resource } from "@rivetjs/runtime/dom";
import { Card } from "./card.tsx";
async function fetchUser(key: unknown) { return "u" + key; }
export function Forms() {
  const { refetch } = resource(fetchUser);
  const [data] = resource(fetchUser) as unknown as [string];
  let later = resource(fetchUser);
  const api = { user: resource(fetchUser) };
  return <Card r={resource(fetchUser)} api={api} onPick={() => refetch()} data={data} later={later} />;
}
function useUser(id: () => number) {
  const user = resource(() => id(), fetchUser);
  return user;
}
const useOther = (id: () => number) => resource(() => id(), fetchUser);
const shared = resource(fetchUser);
export default function page() {
  const own = resource(fetchUser);
  resource(fetchUser);
  return <i onClick={() => { const inHandler = resource(fetchUser); inHandler.refetch(); }}>{own()}{shared()}</i>;
}`;

test("RV2016: destructured, `let`, non-const and hook resources warn in resume mode (both targets, code emitted)", () => {
  for (const target of ["server", "dom"] as const) {
    const result = compile(unresumable, { target, filename: "r.tsx", resume });
    assert.deepEqual(result.diagnostics, [], target);
    assert.ok(result.code.length > 0);
    const warnings = (result.warnings ?? []).filter((w) => w.code === "RV2016");
    assert.deepEqual(
      warnings.map((w) => [w.line, /when destructured \(`const [{[]|from a `let`|outside a `const` initializer|inside `\w+`/.exec(w.message)?.[0]]),
      [
        [5, "when destructured (`const {"],
        [6, "when destructured (`const ["],
        [7, "from a `let`"],
        [8, "outside a `const` initializer"],
        [9, "outside a `const` initializer"],
        [12, "inside `useUser`"],
        [15, "outside a `const` initializer"],
      ],
      target,
    );
    for (const w of warnings) {
      assert.equal(w.severity, "warning");
      assert.match(w.message, /create it in the component as `const name = resource\(…\)`/);
    }
  }
  const plain = compile(unresumable, { target: "server", filename: "r.tsx" });
  assert.equal(plain.warnings, undefined, "no resume: no warning");
});

test("RV2016 through `check` (resume mode)", () => {
  const result = check(unresumable, { filename: "r.tsx", resume });
  const codes = result.diagnostics.filter((d) => d.code === "RV2016");
  assert.equal(codes.length, 7);
  assert.ok(codes.every((d) => d.severity === "warning"));
});

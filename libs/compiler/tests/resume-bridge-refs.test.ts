// Function Bridge T3 (C3 + fix round 1): module functions / imports used as values in a resume module are module references.
// Ids `<unit>#<name>$<h5>$ref`: unit = the module itself (own functions) or the imported module (its resolved module id
// from `resolvedImports`, else the specifier / the relative specifier resolved against the importer), h5 = 5 base-36
// digits of FNV-1a over unit + exported name — one id per value in every importer, distinct export names per module.
// The server epilogue stamps thunks (`__rivetR_mod(() => x, id[, 1])`): an import cycle may still hold `x` in its TDZ.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { _compileSymbolModule, compile } from "../index.ts";
import { roundTrip } from "../../runtime/tests/resume/bridge-encode.ts";

type Sym = {
  id: string;
  name: string;
  kind: string;
  component: string;
  captures: string[];
  source: string;
  imports: { local: string; imported: string; from: string }[];
  locals: string[];
};
type Result = { code: string; diagnostics: { code: string; message: string }[]; symbols: Sym[] };
const raw = (source: string, target: "server" | "dom", module = "src/a.tsx", resolvedImports?: Record<string, string>): Result =>
  compile(source, { target, filename: "a.tsx", resume: { module }, ...(resolvedImports ? { resolvedImports } : {}) } as never) as unknown as Result;
const out = (source: string, target: "server" | "dom", module = "src/a.tsx", resolvedImports?: Record<string, string>): Result => {
  const r = raw(source, target, module, resolvedImports);
  assert.deepEqual(r.diagnostics, []);
  return r;
};

// Twin of `resume.rs` `content_digest` (FNV-1a 64, NUL-joined parts, 13 base-36 digits least significant first).
const MASK = (1n << 64n) - 1n;
const digest = (...parts: string[]): string => {
  let h = 0xcbf29ce484222325n;
  parts.forEach((part, i) => {
    if (i > 0) h = (h * 0x100000001b3n) & MASK;
    for (const byte of Buffer.from(part)) h = ((h ^ BigInt(byte)) * 0x100000001b3n) & MASK;
  });
  let s = "";
  for (let i = 0; i < 13; i++, h /= 36n) s += "0123456789abcdefghijklmnopqrstuvwxyz"[Number(h % 36n)];
  return s;
};
const name = (unit: string, exported: string) => `${exported.replace(/[^\w$]/g, "_")}$${digest(unit, exported).slice(0, 5)}$ref`;
const ref = (unit: string, exported: string) => `${unit}#${name(unit, exported)}`;
// An own function the module does not export: `<local>$l` with a salted digest (no import can name it, fix round 2 N1a).
const local = (unit: string, name: string) => `${unit}#${name}$l$${digest(unit, "\0local", name).slice(0, 5)}$ref`;
const esc = (s: string) => s.replace(/[$.*+?()[\]{}|\\/]/g, "\\$&");

const source = `import { signal } from "@rivetjs/reactivity";
import { double } from "fake-util";
function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }
export function Page() {
  const n = signal(0);
  const api = { inc, double };
  return <button onClick={() => api.inc(n)}>{n()}</button>;
}`;

test("value uses of module functions and imports register thunk stamps at module end", () => {
  const server = out(source, "server").code;
  assert.match(
    server,
    new RegExp(
      `__rivetR_mod\\(\\(\\(\\) => inc\\), "${esc(local("src/a.tsx", "inc"))}"\\);\\s*__rivetR_mod\\(\\(\\(\\) => double\\), "${esc(ref("fake-util", "double"))}", 1\\);\\s*$`,
    ),
  );
  assert.match(server, /_rMod as __rivetR_mod/);
  assert.doesNotMatch(out(source, "dom").code, /_rMod|__rivetR_mod/);
});

test("reference symbols: own functions from the module, imports straight from their module (never the importer)", () => {
  const symbols = out(source, "dom").symbols;
  const inc = symbols.find((s) => s.id === local("src/a.tsx", "inc"))!;
  assert.equal(inc.kind, "ref");
  assert.equal(inc.component, "Page");
  assert.deepEqual(inc.captures, []);
  assert.deepEqual(inc.locals, ["inc"]);
  assert.equal(inc.source, `export const ${inc.name} = () => (inc);\n`);
  const double = symbols.find((s) => s.id === ref("fake-util", "double"))!;
  const alias = "__rivetRef_" + name("fake-util", "double");
  assert.deepEqual(
    double.imports.map((i) => [i.local, i.imported, i.from]),
    [[alias, "double", "fake-util"]],
  );
  assert.deepEqual(double.locals, []);
  assert.equal(double.source, `export const ${double.name} = () => (${alias});\n`);
  // The DOM main module exports the module function for its reference symbol.
  assert.match(out(source, "dom").code, /export \{[^}]*\binc\b/);
});

test("an import has the same id in every importer; resolved module ids join spellings, keep util.ts / util/index.ts apart", () => {
  const importer = (spec: string) =>
    `import { signal } from "@rivetjs/reactivity";
import { fmt as f } from "${spec}";
export function View() { const n = signal(0); const o = { f }; return <button onClick={() => o.f(n)}>{n()}</button>; }`;
  const id = (module: string, spec: string, resolved?: Record<string, string>) =>
    out(importer(spec), "dom", module, resolved).symbols.find((s) => s.kind === "ref")!.id;
  // Without resolution: the relative specifier resolved against the importer (spelling kept).
  assert.equal(id("src/routes/a.tsx", "../lib/fmt.ts"), ref("src/lib/fmt.ts", "fmt"));
  assert.equal(id("src/b.tsx", "./lib/fmt.ts"), ref("src/lib/fmt.ts", "fmt"));
  // With `resolvedImports` (vite): every spelling of one file → one id.
  const spellings = ["./lib/fmt", "./lib/fmt.js", "./lib/fmt.ts"].map((spec) => id("src/b.tsx", spec, { [spec]: "src/lib/fmt.ts" }));
  assert.deepEqual(new Set(spellings), new Set([ref("src/lib/fmt.ts", "fmt")]));
  assert.notEqual(id("src/b.tsx", "./util", { "./util": "src/util/index.ts" }), id("src/b.tsx", "./util.ts", { "./util.ts": "src/util.ts" }));
  // An import of a resume module's own export gets that module's own id.
  assert.equal(id("src/b.tsx", "./util", { "./util": "src/util.tsx" }), ref("src/util.tsx", "fmt"));
});

test("export names never collide: two default imports, one name from two modules, own + namespace member, non-identifiers", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
import a from "./a.ts";
import b from "pkg-b";
import { fmt as f1 } from "p1";
import { fmt as f2 } from "p2";
import * as u from "./u.ts";
import { "a-b" as dashed } from "p3";
function double(x: number) { return x * 2; }
export function Page() {
  const n = signal(0);
  const all = { a, b, f1, f2, double, ud: u.double, dashed };
  return <button onClick={() => n.set(Object.keys(all).length)}>{n()}</button>;
}`;
  const refs = out(code, "dom").symbols.filter((s) => s.kind === "ref");
  assert.deepEqual(
    refs.map((s) => s.id).sort(),
    [
      ref("p1", "fmt"),
      ref("p2", "fmt"),
      ref("p3", "a-b"),
      ref("pkg-b", "default"),
      ref("src/a.ts", "default"),
      local("src/a.tsx", "double"),
      ref("src/u.ts", "double"),
    ].sort(),
  );
  assert.equal(new Set(refs.map((s) => s.name)).size, refs.length);
  const server = out(code, "server").code;
  for (const r of refs) assert.ok(server.includes(JSON.stringify(r.id)), r.id);
});

test("namespace and default members import only that member", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
import * as u from "./util.ts";
import pad from "pad-lib";
export function Page() {
  const n = signal(0);
  const list = [u.half, pad.left];
  return <button onClick={() => n.set(list.length)}>{n()}</button>;
}`;
  const symbols = out(code, "dom").symbols;
  const half = symbols.find((s) => s.id === ref("src/util.ts", "half"))!;
  assert.deepEqual(
    half.imports.map((i) => [i.imported, i.from]),
    [["half", "./util.ts"]],
  );
  assert.equal(half.source, `export const ${half.name} = () => (${half.imports[0]!.local});\n`);
  const left = symbols.find((s) => s.id === ref("pad-lib", "default.left"))!;
  assert.deepEqual(
    left.imports.map((i) => [i.imported, i.from]),
    [["default", "pad-lib"]],
  );
  assert.equal(left.source, `export const ${left.name} = () => (${left.imports[0]!.local}.left);\n`);
  assert.ok(out(code, "server").code.includes(`__rivetR_mod((() => u.half), "${ref("src/util.ts", "half")}", 1);`));
});

test("a module reference replaces the CORE-GAPS prop / alias _rFn sites and the equals site (no dead symbols)", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
function inc() {}
const byId = (a: { id: number }, b: { id: number }) => a.id === b.id;
function Box(props: { on: unknown; g: unknown }) { return <i>{String(props.on)}</i>; }
export function Page() {
  const f = inc;
  const item = signal({ id: 1 }, { equals: byId });
  return <div><Box on={inc} g={f} /><button onClick={() => item.set({ id: 2 })}>{f.name}</button></div>;
}`;
  const server = out(code, "server").code;
  assert.doesNotMatch(server, /__rivetR_fn\(/);
  const kinds = out(code, "dom").symbols.map((s) => s.kind);
  assert.ok(!kinds.includes("equals"), kinds.join());
  assert.deepEqual(
    out(code, "dom")
      .symbols.filter((s) => s.kind === "ref")
      .map((s) => s.id)
      .sort(),
    [local("src/a.tsx", "byId"), local("src/a.tsx", "inc")].sort(),
  );
});

test("callee-only uses, handler bodies, helpers, framework imports and context tokens register nothing", () => {
  const callOnly = `import { signal, untrack, useContext } from "@rivetjs/reactivity";
import { ButtonContext } from "./ctx.ts";
function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }
function helper() { return { inc }; }
export function Page() {
  const n = signal(0);
  const u = { untrack };
  const ctx = useContext(ButtonContext);
  const values = [[ButtonContext, ctx]];
  return <button onClick={() => { inc(n); const later = { inc }; void later; void u; void values; helper(); }}>{n()}</button>;
}`;
  assert.doesNotMatch(out(callOnly, "server").code, /__rivetR_mod/);
  assert.ok(!out(callOnly, "dom").symbols.some((s) => s.kind === "ref"));
});

test("modules without module references compile unchanged (no _rMod import)", () => {
  const plain = `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); return <button onClick={() => n.set(n() + 1)}>{n()}</button>; }`;
  assert.doesNotMatch(out(plain, "server").code, /_rMod|__rivetR_mod/);
});

test("an import cycle evaluating the importer first loads (no TDZ read at module load) and stamps on the next render", async () => {
  // entry → b → a: `a` evaluates before `b` initialised `thrice` (review H3 repro, node ESM).
  const a = out(
    `import { thrice } from "./b.mjs";
export function Page() { const api = { thrice }; return <button onClick={() => api.thrice(1)}>x</button>; }`,
    "server",
    "src/a.tsx",
  ).code;
  const b = out(
    `import { Page } from "./a.mjs";
export const thrice = (x: number) => x * 3;
export function Other() { return <Page />; }`,
    "server",
    "src/b.tsx",
  ).code;
  const dir = mkdtempSync(join(tmpdir(), "rivet-t3-cycle-"));
  try {
    const resolve = (code: string) => code.replace(/"(@rivetjs\/[^"]+)"/g, (_, spec: string) => JSON.stringify(import.meta.resolve(spec)));
    writeFileSync(join(dir, "a.mjs"), resolve(a));
    writeFileSync(join(dir, "b.mjs"), resolve(b));
    writeFileSync(join(dir, "entry.mjs"), 'export * from "./b.mjs";\n');
    const mod = (await import(pathToFileURL(join(dir, "entry.mjs")).href)) as { thrice: unknown };
    const id = ref("src/b.mjs", "thrice");
    const { values } = await roundTrip(() => [mod.thrice], { [id]: () => "browser-thrice" });
    assert.deepEqual(values, ["browser-thrice"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("own reference ids use the EXPORTED name; a local the module does not export can never share an import's id (N1a)", () => {
  // Server stamps `__rivetR_mod((() => x), id)`, local name → id.
  const stamps = (code: string, module = "src/a.tsx", map?: Record<string, string>) =>
    Object.fromEntries([...out(code, "server", module, map).code.matchAll(/__rivetR_mod\(\(\(\) => (\w+)\), "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const codes = (code: string, target: "server" | "dom") => raw(code, target).diagnostics.map((d) => d.code);
  // `export { plus as inc }`: importers of `inc` reach `plus` — so does `plus`'s own id; the local `inc` is not exported → salted id.
  const aliased = `import { signal } from "@rivetjs/reactivity";
const inc = (n: number) => n + 1;
const plus = (n: number) => n + 2;
export { plus as inc };
export function Page() { const n = signal(0); const api = { plus, hidden }; return <button onClick={() => n.set(api.plus(1))}>{n()}</button>; }
function hidden() {}`;
  const own = stamps(aliased);
  assert.equal(own.plus, ref("src/a.tsx", "inc"));
  assert.equal(own.hidden, local("src/a.tsx", "hidden"));
  const importer = `import { signal } from "@rivetjs/reactivity";
import { inc } from "./a";
export function View() { const n = signal(0); const o = { inc }; return <button onClick={() => n.set(o.inc(1))}>{n()}</button>; }`;
  assert.equal(stamps(importer, "src/b.tsx", { "./a": "src/a.tsx" }).inc, own.plus);
  assert.equal(out(importer, "dom", "src/b.tsx", { "./a": "src/a.tsx" }).symbols.find((s) => s.kind === "ref")!.id, own.plus);
  // DOM: `plus` is exported as `inc` only → the module appends `export { plus }` for its symbol modules.
  const dom = out(aliased, "dom");
  assert.match(dom.code, /export \{ (?:[\w$]+, )*plus(?:, [\w$]+)* \};/);
  assert.match(_compileSymbolModule(dom.symbols.filter((s) => s.kind === "ref") as never, "src/a.tsx"), /import \{ plus, hidden \} from "src\/a.tsx"/);
  // The local `inc` used next to `export { plus as inc }`, or next to `export { … as inc } from "./other"`: the
  // module's `inc` is another binding — a build error on both targets (RV2008), never a shared id or the wrong import.
  const usesLocal = aliased.replace("const api = { plus, hidden }", "const api = { inc, plus }");
  const reexport = `import { signal } from "@rivetjs/reactivity";
const inc = (n: number) => n + 1;
export { inc as other };
export { plus as inc } from "./other";
export function Page() { const n = signal(0); const api = { inc }; return <button onClick={() => n.set(api.inc(1))}>{n()}</button>; }`;
  for (const code of [usesLocal, reexport, reexport.replace("export { inc as other };\n", "")])
    for (const target of ["server", "dom"] as const) assert.deepEqual(codes(code, target), ["RV2008"]);
  // Exported under its own name (declaration, default): the importers' id; a default function declaration is
  // exported again under its local name for the symbol modules.
  const declared = aliased
    .replace("const inc = (n: number) => n + 1;", "export function inc(n: number) { return n + 1; }")
    .replace("export { plus as inc };\n", "")
    .replace("{ plus, hidden }", "{ inc, plus }");
  assert.equal(stamps(declared).inc, ref("src/a.tsx", "inc"));
  assert.equal(stamps(declared).plus, local("src/a.tsx", "plus"));
  const byDefault = aliased.replace("export { plus as inc };", "export default plus;");
  assert.equal(stamps(byDefault).plus, ref("src/a.tsx", "default"));
  const defaultFn = byDefault
    .replace("const plus = (n: number) => n + 2;\n", "")
    .replace("export default plus;", "export default function plus(n: number) { return n + 2; }");
  assert.equal(stamps(defaultFn).plus, ref("src/a.tsx", "default"));
  assert.match(out(defaultFn, "dom").code, /export \{ (?:[\w$]+, )*plus(?:, [\w$]+)* \};/);
});

test("the query is part of the unit: two `?image` widths and `?jsx` of one file are three references (N1b)", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
import small from "./a.jpg?w=64&image";
import large from "./a.jpg?w=1200&image";
import Art from "./a.jpg?jsx";
export function Page() { const n = signal(0); const all = [small, large, Art]; return <button onClick={() => n.set(all.length)}>{n()}</button>; }`;
  const resolved = { "./a.jpg?w=64&image": "src/a.jpg?w=64&image", "./a.jpg?w=1200&image": "src/a.jpg?w=1200&image", "./a.jpg?jsx": "src/a.jpg?jsx" };
  for (const map of [resolved, undefined]) {
    const refs = out(code, "dom", "src/a.tsx", map)
      .symbols.filter((s) => s.kind === "ref")
      .map((s) => s.id);
    assert.deepEqual(refs.sort(), [ref("src/a.jpg?jsx", "default"), ref("src/a.jpg?w=1200&image", "default"), ref("src/a.jpg?w=64&image", "default")].sort());
  }
});

test("collision names: the generated symbol module compiles (string export names imported quoted, N2)", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
import a from "./a.ts";
import b from "pkg-b";
import { fmt as f1 } from "p1";
import { fmt as f2 } from "p2";
import { "a-b" as dashed } from "p3";
export function Page() { const n = signal(0); const all = { a, b, f1, f2, dashed }; return <button onClick={() => n.set(Object.keys(all).length)}>{n()}</button>; }`;
  const refs = out(code, "dom").symbols.filter((s) => s.kind === "ref");
  const module = _compileSymbolModule(refs as never, "src/a.tsx");
  assert.match(module, /import \{ "a-b" as __rivetRef_a_b\$\w+\$ref \} from "p3"/);
  for (const r of refs) assert.match(module, new RegExp(`export \\{[^}]*\\b${esc(r.name)}\\b|export const ${esc(r.name)}\\b`));
});

test("a module reference used by several components lists them in `uses` (one component: absent)", () => {
  const code = `import { signal } from "@rivetjs/reactivity";
function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }
function dec(s: { (): number; set(v: number): void }) { s.set(s() - 1); }
export function A() { const n = signal(0); const o = { inc, dec }; return <button onClick={() => o.inc(n)}>{n()}</button>; }
export function B() { const n = signal(0); const o = { inc }; return <button onClick={() => o.inc(n)}>{n()}</button>; }`;
  const refs = out(code, "dom").symbols.filter((s) => s.kind === "ref") as (Sym & { uses?: string[] })[];
  assert.deepEqual(refs.find((s) => s.id === local("src/a.tsx", "inc"))!.uses, ["A", "B"]);
  assert.equal(refs.find((s) => s.id === local("src/a.tsx", "dec"))!.uses, undefined);
});

test("a value exported under several names has one own id — the smallest name; the others are `aliases` (L2)", () => {
  const code = (exports: string) => `import { signal } from "@rivetjs/reactivity";
const inc = (n: number) => n + 1;
${exports}
export function Page() { const n = signal(0); const api = { inc }; return <button onClick={() => n.set(api.inc(1))}>{n()}</button>; }`;
  const own = (exports: string) => out(code(exports), "dom").symbols.find((s) => s.kind === "ref") as Sym & { aliases?: string[] };
  const both = own("export { inc, inc as plus };");
  assert.equal(both.id, ref("src/a.tsx", "inc"));
  assert.deepEqual(both.aliases, ["plus"]);
  const byDefault = own("export { inc };\nexport default inc;");
  assert.equal(byDefault.id, ref("src/a.tsx", "default"));
  assert.deepEqual(byDefault.aliases, ["inc"]);
  // Same order-independent pick on the server stamp.
  assert.match(out(code("export { inc as plus, inc };"), "server").code, new RegExp(esc(JSON.stringify(ref("src/a.tsx", "inc")))));
  // One name: no aliases.
  assert.equal(own("export { inc };").aliases, undefined);
});

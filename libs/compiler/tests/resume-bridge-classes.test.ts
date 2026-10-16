// Function Bridge T24 (C12): module data classes register; field arrows capture `this`; ineligible classes are RV2102
// (D-priv: `#private` fields, built-in / package bases, resource reads) — never registered. T25: `static [revive]` classes register.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../index.ts";

type Out = { code: string; diagnostics: { code: string; message: string }[]; symbols: { id: string; kind: string; source: string; captures: string[] }[] };
const run = (prelude: string, setup: string, target: "server" | "dom" = "server") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";
${prelude}
export function Page() { const n = signal(0); ${setup} return <button onClick={() => n.set(v ? 1 : 0)}>{n()}</button>; }`,
    { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as unknown as Out;

test("a captured data class instance registers its class", () => {
  const r = run("class User { name: string; constructor(n: string) { this.name = n; } }", 'const v = new User("ada");');
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivetR_class\(User, "src\/a\.tsx#User\$class"\);\s*$/);
  assert.match(r.code, /import \{[^}]*_rClass as __rivetR_class[^}]*\} from "@rivetjs\/runtime\/server-resume"/);
  const dom = run("class User { name: string; constructor(n: string) { this.name = n; } }", 'const v = new User("ada");', "dom");
  const symbol = dom.symbols.find((s) => s.id === "src/a.tsx#User$class")!;
  assert.equal(symbol.kind, "class");
  assert.match(symbol.source, /export const User\$class = \(\) => \(User\);/);
  assert.match(dom.code, /export \{[^}]*\bUser\b/);
});

test("every eligible module class registers (review T23 M2); a local data subclass too", () => {
  const r = run("class Base { a = 1; } export class Sub extends Base { b = 2; } class Unused { c = 3; }", "const v = new Sub();");
  assert.deepEqual(r.diagnostics, []);
  for (const name of ["Base", "Sub", "Unused"]) assert.match(r.code, new RegExp(`__rivetR_class\\(${name}, "src/a\\.tsx#${name}\\$class"\\);`));
});

test("class-field arrows capture this", () => {
  const r = run("class Counter { c = 0; inc = () => this.c++; }", "const v = new Counter();");
  assert.match(r.code, /inc = __rivetR_fn\("src\/a\.tsx#Counter\$[0-9a-z_]+", \(\) => this\.c\+\+, \[this\]\)/);
  const sym = run("class Counter { c = 0; inc = () => this.c++; }", "const v = new Counter();", "dom").symbols.find(
    (s) => s.id.includes("#Counter$") && !s.id.endsWith("$class"),
  )!;
  assert.match(sym.source, /\(__rivetSelf\) => \(\) => __rivetSelf\.c\+\+/);
  assert.deepEqual(sym.captures, ["__rivetSelf"]);
  // A nested non-arrow function keeps its own `this`; module names come from the module.
  const nested = run(
    "const step = 2; class Counter { c = 0; inc = () => { const o = { f() { return this; } }; return (this.c += step), o; }; }",
    "const v = new Counter();",
    "dom",
  ).symbols.find((s) => s.id.includes("#Counter$") && !s.id.endsWith("$class"))!;
  assert.match(nested.source, /f\(\) \{ return this; \}/);
  assert.match(nested.source, /__rivetSelf\.c \+= step/);
});

test("RV2102: a class whose field reads window, without static [revive]", () => {
  const [d] = run('class Conn { live = typeof window !== "undefined"; }', "const conn = new Conn(); const v = conn;").diagnostics;
  assert.equal(d?.code, "RV2102");
  assert.match(d!.message, /Cannot resume `conn\.live`: Conn instance holds a resource/);
  const ctor = run(
    'class Conn { url: string; live: boolean; constructor(u: string) { this.url = u; this.live = typeof window !== "undefined"; } }',
    'const v = new Conn("x");',
  );
  assert.equal(ctor.diagnostics[0]?.code, "RV2102");
  assert.match(
    ctor.diagnostics[0]!.message,
    /Cannot resume `v\.live`: Conn instance holds a resource \(its field reads `window`\); create it inside the handler, build it with reconstruct\(\(\) => new Conn\(…\)\) or give Conn a static \[revive\]/,
  );
  // A read inside a method / function-valued field is not a resource of the instance (RV2001 still reports browser globals).
  const lazy = run("class Lazy { n = 1; read() { return window.name; } f = () => document.title; }", "const v = new Lazy();").diagnostics;
  assert.deepEqual(
    lazy.filter((d) => d.code !== "RV2001"),
    [],
  );
});

test("RV2102 (D-priv): a #private field is named; the class never registers", () => {
  const r = run("class Money { #c: number; constructor(c: number) { this.#c = c; } cents() { return this.#c; } }", "const v = new Money(1);");
  assert.equal(r.diagnostics[0]?.code, "RV2102");
  assert.match(r.diagnostics[0]!.message, /Cannot resume `v\.#c`: Money instance has a private field/);
  assert.match(r.diagnostics[0]!.message, /give Money a static \[revive\]/);
  const plain = run("class Money { #c = 1; } class Ok { a = 1; }", "const v = 1;");
  assert.doesNotMatch(plain.code, /__rivetR_class\(Money/);
  assert.match(plain.code, /__rivetR_class\(Ok,/);
});

test("RV2102: built-in and package bases (review T23 M1 / re-review info) never register", () => {
  for (const [prelude, base] of [
    ["class Table extends Map<string, number> {}", "Map"],
    ['import { EventEmitter } from "node:events"; class Table extends EventEmitter {}', "EventEmitter"],
    ['import { Money } from "./money"; class Table extends Money {}', "Money"],
  ] as const) {
    const r = run(prelude, "const v = new Table();");
    assert.equal(r.diagnostics[0]?.code, "RV2102", prelude);
    assert.match(r.diagnostics[0]!.message, new RegExp(`Cannot resume \`v\`: Table extends \`${base}\``), prelude);
    assert.doesNotMatch(run(prelude, "const v = 1;").code, /__rivetR_class\(Table/, prelude);
  }
  // A subclass of a local ineligible class inherits its verdict.
  const sub = run("class Money { #c = 1; } class Euro extends Money {}", "const v = new Euro();");
  assert.match(sub.diagnostics[0]!.message, /Cannot resume `v\.#c`: Euro instance has a private field/);
});

// `node --check` of an emitted module (a symbol chunk that does not parse breaks every symbol in it).
const parses = (code: string): void => {
  const file = join(mkdtempSync(join(tmpdir(), "rv-cls-")), "m.mjs");
  writeFileSync(file, code);
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
};

test("RV2102 (review T24 M1): a field arrow reading super / new.target is never lifted; the class is refused, or kept unlifted under static [revive]", () => {
  for (const [body, what] of [
    ["go = () => super.h();", "super"],
    ["t = () => new.target;", "new.target"],
  ] as const) {
    const prelude = `class B { h() { return 1; } } class S extends B { ${body} }`;
    const r = run(prelude, "const v = new S();");
    assert.equal(r.diagnostics[0]?.code, "RV2102", body);
    assert.match(r.diagnostics[0]!.message, new RegExp(`Cannot resume \`v\\.(go|t)\`: S field arrow reads \`${what.replace(".", "\\.")}\``), body);
    assert.doesNotMatch(run(prelude, "const v = 1;").code, /__rivetR_class\(S,/, body);
    // Under `static [revive]` the class registers and the arrow stays a plain field: both outputs parse.
    const revived = `import { revive } from "@rivetjs/runtime/resume-format"; class B { h() { return 1; } } class S extends B { ${body} static [revive]() { return new S(); } }`;
    const server = run(revived, "const v = new S();");
    assert.deepEqual(server.diagnostics, [], body);
    assert.match(server.code, /__rivetR_class\(S, "src\/a\.tsx#S\$class"\);/);
    assert.doesNotMatch(server.code, /__rivetR_fn\("src\/a\.tsx#S\$(?!class)/, body);
    parses(server.code);
    const dom = run(revived, "const v = new S();", "dom");
    assert.ok(!dom.symbols.some((s) => s.id.includes("#S$") && !s.id.endsWith("$class")), body);
    for (const symbol of dom.symbols) parses(symbol.source);
  }
  // A nested non-arrow function has its own `super` / `new.target`: still lifted.
  const nested = run("class S { f = () => { function g() { return new.target; } return g; }; }", "const v = new S();", "dom");
  assert.deepEqual(nested.diagnostics, []);
  assert.ok(nested.symbols.some((s) => s.id.includes("#S$") && !s.id.endsWith("$class")));
});

test("RV2102 (review T24 L2): decorated classes (class or member decorators) never register", () => {
  for (const prelude of [
    "function dec(c: unknown) { return c as never; } @dec class D { a = 1; }",
    "function dec(_v: unknown, _c: unknown) {} class D { @dec a = 1; }",
    "function dec(_v: unknown, _c: unknown) {} class D { @dec m() {} }",
  ]) {
    const r = run(prelude, "const v = new D();");
    assert.equal(r.diagnostics[0]?.code, "RV2102", prelude);
    assert.match(r.diagnostics[0]!.message, /Cannot resume `v`: D is decorated \(`@dec` runs code when the class is constructed/, prelude);
    assert.doesNotMatch(run(prelude, "const v = 1;").code, /__rivetR_class\(D,/, prelude);
  }
});

test("RV2102 (review T24 L3): private methods / getters and `accessor` fields are refused; sound shapes register", () => {
  for (const [body, field] of [
    ["#m() { return 1; } a = 1;", "#m"],
    ["get #g() { return 1; } a = 1;", "#g"],
    ["accessor x = 1;", "x"],
  ] as const) {
    const r = run(`class P { ${body} }`, "const v = new P();");
    assert.equal(r.diagnostics[0]?.code, "RV2102", body);
    assert.match(r.diagnostics[0]!.message, new RegExp(`Cannot resume \`v\\.${field}\`: P instance has a private field`), body);
  }
  // Sound (the same module code runs in the browser): static blocks, computed keys, static #private, prototype mutation.
  const sound = run(
    'const k = "b"; class Q { static #n = 0; static { Q.#n = 1; } a = 1; [k] = 2; static count() { return Q.#n; } } Q.prototype.extra = function () { return 1; };',
    "const v = new Q();",
  );
  assert.deepEqual(
    sound.diagnostics.filter((d) => d.code === "RV2102"),
    [],
  );
  assert.match(sound.code, /__rivetR_class\(Q, "src\/a\.tsx#Q\$class"\);/);
});

test("static [revive] classes (T25 resource holders) register without RV2102, private fields and resource reads included", () => {
  const prelude =
    'import { revive, serialize } from "@rivetjs/runtime/resume-format"; class Conn { #ws = 1; live = typeof window; [serialize]() { return 1; } static [revive](d: unknown) { return new Conn(); } }';
  const r = run(prelude, "const v = new Conn();");
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivetR_class\(Conn, "src\/a\.tsx#Conn\$class"\);/);
  const dom = run(prelude, "const v = new Conn();", "dom");
  assert.match(dom.symbols.find((s) => s.id === "src/a.tsx#Conn$class")!.source, /export const Conn\$class = \(\) => \(Conn\);/);
  // An inherited `static [revive]` (subclass of a revive class) registers too.
  const sub = run(prelude + " class Wss extends Conn {}", "const v = new Wss();");
  assert.deepEqual(sub.diagnostics, []);
  assert.match(sub.code, /__rivetR_class\(Wss, "src\/a\.tsx#Wss\$class"\);/);
});

test("review T25 M1: a static [revive] class lifts no field arrows (a #private read would not parse); a data class still does", () => {
  const prelude =
    'import { revive, serialize } from "@rivetjs/runtime/resume-format"; class M { #c = 1; inc = () => this.#c++; [serialize]() { return this.#c; } static [revive](d: number) { return new M(); } }';
  const server = run(prelude, "const v = new M();");
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetR_class\(M, "src\/a\.tsx#M\$class"\);/);
  assert.doesNotMatch(server.code, /__rivetR_fn\("src\/a\.tsx#M\$(?!class)/);
  assert.match(server.code, /inc = \(\) => this\.#c\+\+/);
  parses(server.code);
  const dom = run(prelude, "const v = new M();", "dom");
  assert.ok(!dom.symbols.some((s) => s.id.includes("#M$") && !s.id.endsWith("$class")));
  for (const symbol of dom.symbols) parses(symbol.source);
  // A data class keeps its lifted field arrow, and every emitted symbol parses.
  const data = run("class Counter { c = 0; inc = () => this.c++; }", "const v = new Counter();", "dom");
  const arrow = data.symbols.find((s) => s.id.includes("#Counter$") && !s.id.endsWith("$class"))!;
  assert.match(arrow.source, /\(__rivetSelf\) => \(\) => __rivetSelf\.c\+\+/);
  for (const symbol of data.symbols) parses(symbol.source);
});

test("an imported class of a resume (.tsx) module is resumable (its module registers it); .ts, packages and class expressions stay RV2003", () => {
  assert.deepEqual(run('import { User } from "./user.tsx";', 'const v = new User("a");').diagnostics, []);
  assert.equal(run('import { User } from "./user";', 'const v = new User("a");').diagnostics[0]?.code, "RV2003");
  assert.equal(run('import { Chart } from "chart-lib";', "const v = new Chart();").diagnostics[0]?.code, "RV2003");
  assert.equal(run("", "const v = new (class { a = 1; })();").diagnostics[0]?.code, "RV2003");
});

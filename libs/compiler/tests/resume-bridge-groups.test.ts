// Function Bridge T10 (C8 + C9): mutual recursion → one group symbol registered once per instance (`_rGroup`); `.bind` of a
// resumable function → `_rBound` (bound-of-bound and module functions too). Brief tests, plus: `const` members (registered
// after the last member's declaration, cell captures in the union), members in different statement lists left alone,
// and the T11 review nit (`this_free`: only `signal` / `computed` / `selector` calls count).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

type Out = { code: string; symbols: { id: string; source: string }[] };
const run = (source: string, target: "server" | "dom") => compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as Out;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const count = (code: string, what: string) => code.split(what).length - 1;
const recursion = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  function even(k: number): boolean { return k === 0 ? true : odd(k - 1); }
  function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }
  return <button onClick={() => n.set(even(10) ? 2 : 1)}>{n()}</button>;
}`;

test("mutually recursive declarations register one group per instance", () => {
  const code = flat(run(recursion, "server").code);
  const m = /function Page\(\) \{ __rivetR_group\(("src\/a\.tsx#Page\$[0-9a-z_]+"), \[even, odd\], \(\) => \[\]\);/.exec(code);
  assert.ok(m, code);
  assert.equal(count(code, "__rivetR_fn("), 0, code);
  assert.match(code, /import \{ _rGroup as __rivetR_group,/);
  const symbols = run(recursion, "dom").symbols;
  const group = symbols.find((s) => JSON.stringify(s.id) === m![1])!;
  assert.match(
    flat(group.source),
    /^export const Page\$[0-9a-z_]+ = \(\) => \{ function even\(k: number\): boolean \{.*\} function odd\(k: number\).*return \[even, odd\]; \};$/,
  );
  // No member symbol: the handler captures `even` (a group member).
  assert.equal(symbols.length, 3);
  assert.ok(symbols.some((s) => /= \(n, even\) =>/.test(s.source)));
});

test("const members register after the last member, with the union of their captures", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0); let hits = 0;
  const even = (k: number): boolean => { hits++; return k === 0 ? true : odd(k - 1); };
  const odd = (k: number): boolean => (k === 0 ? false : n() > 99 || even(k - 1));
  return <button onClick={() => n.set(even(n()) ? hits : 1)}>{n()}</button>;
}`;
  const code = flat(run(source, "server").code);
  assert.match(
    code,
    /const odd = \(k\) => k === 0 \? false : n\(\) > 99 \|\| even\(k - 1\); __rivetR_group\("src\/a\.tsx#Page\$[0-9a-z_]+", \[even, odd\], \(\) => \[hits, n\]\);/,
  );
  const group = run(source, "dom").symbols.find((s) => s.source.includes("return [even, odd]"))!;
  assert.match(
    flat(group.source),
    /= \(hits, n\) => \{ const even = \(\(k: number\): boolean => \{ hits\.v\+\+;.* const odd = \(.*\); return \[even, odd\]; \};$/,
  );
});

test("functions in different statement lists are not grouped", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  function even(k: number): boolean { function odd(j: number): boolean { return j === 0 ? false : even(j - 1); } return k === 0 ? true : odd(k - 1); }
  return <button onClick={() => n.set(even(4) ? 2 : 1)}>{n()}</button>;
}`;
  assert.equal(count(run(source, "server").code, "__rivetR_group("), 0);
});

test(".bind of a resumable local becomes _rBound on the server only", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); const add = (by: number) => n.set(n() + by); const inc = add.bind(null, 2);
  return <button onClick={() => inc()}>{n()}</button>; }`;
  const server = run(source, "server").code;
  assert.match(server, /const inc = __rivetR_bound\(add, null, \[2\]\)/);
  assert.match(server, /const add = __rivetR_fn\(/);
  assert.match(run(source, "dom").code, /add\.bind\(null, 2\)/);
});

test("bound-of-bound and module functions are rewritten; an uncaptured bind is left alone", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
function plus(a: number, b: number) { return a + b; }
export function Page() {
  const n = signal(0); const add = (a: number, b: number) => n.set(n() + a * b);
  const by2 = add.bind(null, 2); const inc = by2.bind(null, 3); const plus3 = plus.bind(null, 3); const idle = add.bind(null, 9);
  return <button onClick={() => { inc(); n.set(plus3(n())); }}>{n()}</button>;
}`;
  const code = flat(run(source, "server").code);
  assert.match(
    code,
    /const by2 = __rivetR_bound\(add, null, \[2\]\); const inc = __rivetR_bound\(by2, null, \[3\]\); const plus3 = __rivetR_bound\(plus, null, \[3\]\); const idle = add\.bind\(null, 9\);/,
  );
  assert.match(code, /__rivetR_mod\(\(\(\) => plus\), "src\/a\.tsx#plus\$/);
});

test("this_free counts only signal / computed / selector calls (T11 review nit)", () => {
  const source = (value: string) => `import { signal, computed, untrack } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0); const h = function () { return 1; };
  const o = { f: ${value}, other: 1 };
  return <button onClick={() => n.set(o.f() ? 1 : 0)}>{n()}</button>;
}`;
  assert.match(run(source("computed(() => 1)"), "server").code, /__rivetR_member\(o, "f"\)/);
  const whole = run(source("untrack(() => h)"), "server").code;
  assert.doesNotMatch(whole, /__rivetR_member\(o, "f"\)/);
  assert.match(flat(whole), /\[n, o\]/);
});

// ── Fix round 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────
const codes = (source: string) =>
  (
    (compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { diagnostics?: { code: string }[] }).diagnostics ??
    []
  ).map((d) => d.code);
const H = `import { signal } from "@rivetjs/reactivity";\n`;

test("F1: two declaration groups in one statement list both register; no dead symbol", () => {
  const source =
    H +
    `export function Page() {
  const n = signal(0);
  function even(k: number): boolean { return k === 0 ? true : odd(k - 1); }
  function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }
  function ping(k: number): number { return k <= 0 ? 0 : pong(k - 1); }
  function pong(k: number): number { return k <= 0 ? 1 : ping(k - 1); }
  return <button onClick={() => n.set(even(10) ? ping(3) : pong(2))}>{n()}</button>;
}`;
  const code = flat(run(source, "server").code);
  assert.match(
    code,
    /function Page\(\) \{ __rivetR_group\("src\/a\.tsx#Page\$[0-9a-z_]+", \[even, odd\], \(\) => \[\]\); __rivetR_group\("src\/a\.tsx#Page\$[0-9a-z_]+", \[ping, pong\], \(\) => \[\]\);/,
  );
  const symbols = run(source, "dom").symbols;
  assert.equal(symbols.filter((s) => s.source.includes("return [")).length, 2);
  assert.equal(symbols.length, 4);
});

test("F5: two const groups ending in one multi-declarator statement both register after it", () => {
  const source =
    H +
    `export function Page() {
  const n = signal(0);
  const even = (k: number): boolean => (k === 0 ? true : odd(k - 1)), ping = (k: number): number => (k <= 0 ? 0 : pong(k - 1)),
    odd = (k: number): boolean => (k === 0 ? false : even(k - 1)), pong = (k: number): number => (k <= 0 ? 1 : ping(k - 1));
  return <button onClick={() => n.set(even(4) ? ping(3) : 2)}>{n()}</button>;
}`;
  const code = flat(run(source, "server").code);
  assert.match(
    code,
    /pong = \(k\) => k <= 0 \? 1 : ping\(k - 1\); __rivetR_group\("[^"]+", \[even, odd\], \(\) => \[\]\); __rivetR_group\("[^"]+", \[ping, pong\], \(\) => \[\]\);/,
  );
});

test("F3: an early exit between the members of a const group is RV2011; declarations and adjacent consts are not", () => {
  const body = (between: string) =>
    H +
    `export function Page(props: { a: boolean }) {
  const n = signal(0);
  const even = (k: number): boolean => (k === 0 ? true : odd(k - 1));
  ${between}
  const odd = (k: number): boolean => (k === 0 ? false : even(k - 1));
  return <i onClick={() => n.set(odd(3) ? 1 : 0)}>{n()}</i>;
}`;
  assert.deepEqual(codes(body("if (props.a) return <b onClick={() => n.set(even(2) ? 1 : 0)}>{n()}</b>;")), ["RV2011"]);
  assert.deepEqual(codes(body("if (props.a) throw new Error('x');")), ["RV2011"]);
  assert.deepEqual(codes(body("for (const x of [1]) { if (x) break; }")), []);
  assert.deepEqual(codes(body("const f = () => { return 1; };")), []);
  assert.deepEqual(codes(body("")), []);
});

test("F4: group captures are narrowed jointly; a whole use in one member widens the base", () => {
  const source = (extra: string) =>
    H +
    `export function Page() {
  const store = { count: signal(0), other: 1 };
  const even = (k: number): boolean => (k === 0 ? store.count() > 0 : odd(k - 1));
  const odd = (k: number): boolean => (k === 0 ? false : even(k - 1)${extra});
  return <button onClick={() => store.count.set(even(4) ? 1 : 2)}>x</button>;
}`;
  assert.match(flat(run(source(""), "server").code), /__rivetR_group\("[^"]+", \[even, odd\], \(\) => \[__rivetR_member\(store, "count"\)\]\);/);
  assert.match(flat(run(source(" && JSON.stringify(store) !== ''"), "server").code), /__rivetR_group\("[^"]+", \[even, odd\], \(\) => \[store\]\);/);
});

test("F2: a bind const used by name as a prop, stored in an object / array / call argument is rewritten", () => {
  const source = (use: string, jsx = "<button onClick={() => api()}>{n()}</button>") =>
    H +
    `function Child(props: { onPress: () => void }) { return <button onClick={() => props.onPress()}>x</button>; }
export function Page() {
  const n = signal(0); const add = (by: number) => n.set(n() + by); const inc = add.bind(null, 2);
  ${use}
  return ${jsx};
}`;
  for (const [use, jsx] of [
    ["", "<Child onPress={inc} />"],
    ["const api = { inc };", "<button onClick={() => api.inc()}>{n()}</button>"],
    ["const list = [inc];", "<button onClick={() => list[0]()}>{n()}</button>"],
    ["const s = signal(inc);", "<button onClick={() => s()()}>{n()}</button>"],
  ]) {
    const code = run(source(use, jsx), "server").code;
    assert.match(code, /const inc = __rivetR_bound\(add, null, \[2\]\)/, use || jsx);
    assert.match(code, /const add = __rivetR_fn\(/, use || jsx);
  }
});

test("F6 + spread rest: casts on the callee are unwrapped; later spread arguments stay in the array", () => {
  const source =
    H +
    `export function Page() {
  const n = signal(0); const add = (a: number, b: number) => n.set(n() + a + b); const rest: [number] = [1];
  const g = (add.bind as any)(null, 2); const h = add.bind(null, ...rest);
  return <button onClick={() => { g(); h(3); }}>{n()}</button>;
}`;
  const code = flat(run(source, "server").code);
  assert.match(code, /const g = __rivetR_bound\(add, null, \[2\]\); const h = __rivetR_bound\(add, null, \[\.\.\.rest\]\);/);
});

test("F9 + fix 2: .bind errors only on provable functions; receivers that may own a `bind` warn, code still emitted", () => {
  const out = (setup: string, call = "go()") => {
    const source =
      H +
      `import { makeStmt } from "./db";\nexport function Page(props: { onPick: (v: number) => void; stmt: { bind(x: number): { id: number } } }) { const n = signal(0); const add = (by: number) => n.set(n() + by); ${setup} return <b onClick={() => ${call}}>{n()}</b>; }`;
    const r = compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as {
      code: string;
      diagnostics: { code: string }[];
      warnings?: { code: string; severity: string }[];
    };
    for (const w of r.warnings ?? []) assert.equal(w.severity, "warning");
    return { errors: r.diagnostics.map((d) => d.code), warnings: (r.warnings ?? []).map((d) => d.code), emitted: r.code.length > 0 };
  };
  const clean = { errors: [], warnings: [], emitted: true };
  const warns = (code: string) => ({ errors: [], warnings: [code], emitted: true });
  // Provable function receiver: errors.
  assert.deepEqual(out("const args: [null, number] = [null, 2]; const go = add.bind(...args);"), { errors: ["RV2012"], warnings: [], emitted: false });
  // Receivers that may be an object with its own `bind` (review probes): warnings only.
  assert.deepEqual(out("const go = props.onPick.bind(null, 2);"), warns("RV2013"));
  assert.deepEqual(out("const pick = props.onPick; const go = pick.bind(null, 2);"), warns("RV2013"));
  assert.deepEqual(out("const stmt = makeStmt(); const s = stmt.bind(4);", "n.set(s.id)"), warns("RV2013"));
  assert.deepEqual(out("const s = props.stmt.bind(4);", "n.set(s.id)"), warns("RV2013"));
  assert.deepEqual(out("const { stmt } = props; const s = stmt.bind(4);", "n.set(s.id)"), warns("RV2013"));
  assert.deepEqual(out("const stmt = makeStmt(); const xs: [number] = [4]; const s = stmt.bind(...xs);", "n.set(s.id)"), warns("RV2012"));
  // RV2014: only a reached `.bind` property (key read or whole object), a warning.
  assert.deepEqual(out("const api = { go: add.bind(null, 1) };", "api.go()"), warns("RV2014"));
  assert.deepEqual(out("const api = { k: 1, go: add.bind(null, 1) };", "console.log(api)"), warns("RV2014"));
  assert.deepEqual(out("const o = { k: 1, s: makeStmt().bind(4) };", "n.set(o.k)"), clean);
  assert.deepEqual(out("const api = { k: 1, go: add.bind(null, 1) };", "n.set(api.k)"), clean);
  // Green.
  assert.deepEqual(out("const go = add.bind(null, 1);"), clean);
  // A `this`-dependent target stays RV2007 with `.bind(ctx)`.
  assert.deepEqual(out("function f(this: { x: number }) { return this.x; } const g = f.bind({ x: 1 });", "n.set(g())"), {
    errors: ["RV2007"],
    warnings: [],
    emitted: false,
  });
});

test("F8 (fix 2): a declaration group after `return` registers at the top of its list in every container shape", () => {
  const G = `function even(k: number): boolean { return k === 0 ? true : odd(k - 1); } function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }`;
  const on = `onClick={() => n.set(even(2) ? 1 : 0)}`;
  const shapes: Record<string, string> = {
    body: `export function Page() { const n = signal(0); return <b ${on}>{n()}</b>; ${G} }`,
    arrow: `export const Page = () => { const n = signal(0); return <b ${on}>{n()}</b>; ${G} };`,
    block: `export function Page(props: { a: boolean }) { const n = signal(0); if (props.a) { return <b ${on}>{n()}</b>; ${G} } return null; }`,
    switchCase: `export function Page(props: { k: number }) { const n = signal(0); switch (props.k) { case 1: return <b ${on}>{n()}</b>; ${G} } return null; }`,
    mapRow: `export function Page() { const xs = [1, 2]; return <ul>{xs.map((x) => { const n = signal(x); return <li ${on}>{n()}</li>; ${G} })}</ul>; }`,
    thunk: `import { Show } from "@rivetjs/runtime/dom";\nexport function Page() { const n = signal(0); return <Show when={n() >= 0}>{() => { return <b ${on}>{n()}</b>; ${G} }}</Show>; }`,
  };
  for (const [name, body] of Object.entries(shapes)) {
    const code = flat(run(H + body, "server").code);
    const group = code.indexOf("__rivetR_group(");
    assert.ok(group >= 0, name);
    assert.ok(group < code.indexOf("function even("), name);
    // registered before the list's first `return` (never dead code after it)
    assert.ok(code.indexOf("return", code.lastIndexOf("{", group)) > group, name);
  }
});

test("W4: RV2014 also covers a group member reaching a `.bind(…)` property (narrowed group captures)", () => {
  const source = (read: string) =>
    H +
    `export function Page() {
  const n = signal(0);
  const add = (by: number) => n.set(n() + by);
  const o = { k: 1, f: add.bind(null, 2) };
  function even(k: number): boolean { return k === 0 ? ${read} : odd(k - 1); }
  function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }
  return <button onClick={() => n.set(even(4) ? 1 : 0)}>{n()}</button>;
}`;
  const warnings = (src: string) =>
    ((compile(src, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { warnings?: { code: string }[] }).warnings ?? []).map(
      (w) => w.code,
    );
  assert.deepEqual(warnings(source("(o.f(), true)")), ["RV2014"]);
  assert.deepEqual(warnings(source("o.k === 1")), []);
});

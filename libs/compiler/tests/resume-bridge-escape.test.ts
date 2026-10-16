// Function Bridge T4 (C4): local functions escaping into a captured holder become symbols.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const server = (body: string, head = "") => {
  const source = `import { signal } from "@rivetjs/reactivity";
${head}
function track<T>(x: T): T { return x; }
export function Page() {
  const n = signal(0);
  ${body}
  return <button onClick={() => go()}>{n()}</button>;
}`;
  const r = compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; diagnostics: unknown[] };
  assert.deepEqual(r.diagnostics, []);
  return r.code.replace(/\s+/g, " ");
};
const ID = String.raw`"src/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;

test("an arrow assigned into a captured object is a symbol", () => {
  const code = server("const api: { inc?: () => void } = {}; api.inc = () => n.set(n() + 1); const go = () => api.inc!();");
  assert.match(code, new RegExp(String.raw`api\.inc = __rivetR_fn\(${ID}, \(\) => n\.set\(n\(\) \+ 1\), \[n\]\)`));
});

test("an arrow passed to signal() / a call / an array in a captured holder's initializer is a symbol", () => {
  assert.match(
    server("const step = signal(() => n.set(n() + 1)); const go = () => step()();"),
    new RegExp(String.raw`signal\(__rivetR_fn\(${ID}, \(\) => n\.set`),
  );
  assert.match(
    server("const fns = track([() => n.set(n() + 1)]); const go = () => fns[0]!();"),
    new RegExp(String.raw`track\(\[__rivetR_fn\(${ID}, \(\) => n\.set`),
  );
});

test("consumed callbacks and holders no site captures stay plain", () => {
  const code = server("const xs = [1, 2].map((x) => x * 2); const unused = [() => 1]; void unused; const go = () => n.set(xs[0]!);");
  // `xs` itself is a recipe (`__rivetR_fn(id, [1, 2].map(…), [])`, unchanged): the callback is not a symbol of its own.
  assert.doesNotMatch(code, new RegExp(String.raw`__rivetR_fn\(${ID}, \(x\) => x \* 2`));
  assert.doesNotMatch(code, new RegExp(String.raw`__rivetR_fn\(${ID}, \(\) => 1\b`));
  assert.match(code, /const unused = \[\(\) => 1\];/);
});

// Fix round 1 (M2): the consumed lists and assignment rules (`escape.rs` `CONSUMED_*`, `stored_functions(…, calls)`).
const wrapped = (code: string, fn: string) => new RegExp(String.raw`__rivetR_fn\(${ID}, ${fn}`).test(code);

test("scheduling globals, .then and @rivetjs/reactivity _regionState / effect (renamed too) consume their callbacks", () => {
  assert.ok(!wrapped(server("const t = setTimeout(() => n.set(1), 0); const go = () => clearTimeout(t);"), String.raw`\(\) => n\.set\(1\)`));
  assert.ok(!wrapped(server("const r = requestAnimationFrame(() => n.set(1)); const go = () => cancelAnimationFrame(r);"), String.raw`\(\) => n\.set\(1\)`));
  assert.ok(!wrapped(server("const p = Promise.resolve(1).then(() => n.set(2)); const go = () => p;"), String.raw`\(\) => n\.set\(2\)`));
  const code = server(
    "const box = rs(() => ({ v: 1 })); const stop = fx(() => void n()); const go = () => (stop(), n.set(box.v));",
    'import { _regionState as rs, effect as fx } from "@rivetjs/reactivity";',
  );
  assert.ok(!wrapped(code, String.raw`\(\) => \(\{ v: 1 \}\)`));
  assert.ok(!wrapped(code, String.raw`\(\) => void n\(\)`));
});

test("a local function shadowing setTimeout is not a scheduling global: its callback argument is stored", () => {
  const code = server("const setTimeout = (f: () => void) => f; const t = setTimeout(() => n.set(1)); const go = () => t();");
  assert.ok(wrapped(code, String.raw`\(\) => n\.set\(1\)`));
});

test("assignments: arrays and direct functions are stored, a call's arguments are not; let / ??= writes count", () => {
  // `Object.freeze` (not consumed, not an own helper): its argument is searched in an initializer, not in an assignment.
  const timer = server("const h: { t?: unknown } = {}; h.t = Object.freeze(() => n.set(1)); const go = () => h;");
  assert.match(timer, /h\.t = Object\.freeze\(\(\) => n\.set\(1\)\)/);
  assert.ok(wrapped(server("const h = Object.freeze(() => n.set(1)); const go = () => h;"), String.raw`\(\) => n\.set\(1\)`));
  const fns = server("const h: { fns?: (() => void)[] } = {}; h.fns = [() => n.set(1)]; const go = () => h.fns![0]!();");
  assert.match(fns, new RegExp(String.raw`h\.fns = \[__rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\)\]`));
  const reassigned = server("let h = () => 0; h = () => n.set(1); const go = () => h();");
  // Function Bridge T8 fix round 1: any write boxes the `let` (a shared cell), its values still become recipes.
  assert.match(reassigned, new RegExp(String.raw`const h = __rivetR_cell\(__rivetR_fn\(${ID}, \(\) => 0, \[\]\)\)`));
  assert.match(reassigned, new RegExp(String.raw`h\.v = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\)`));
  const nullish = server("const h: { x?: () => void } = {}; h.x ??= () => n.set(1); const go = () => h.x!();");
  assert.match(nullish, new RegExp(String.raw`h\.x \?\?= __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\)`));
});

test("holders reached through a holder function's captures are searched too (fixpoint)", () => {
  const code = server("const inner: { f?: () => void } = {}; inner.f = () => n.set(1); const outer = signal(() => inner.f!()); const go = () => outer()();");
  assert.match(code, new RegExp(String.raw`signal\(__rivetR_fn\(${ID}, \(\) => inner\.f\(\), \[inner\]\)`));
  assert.match(code, new RegExp(String.raw`inner\.f = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\)`));
});

// Fix round 1 (M1): the capture list is read where the function is created — a capture still in its TDZ keeps it plain.
test("a holder function capturing the holder in its own initializer, or a binding declared later, stays plain", () => {
  assert.match(server("let retry = () => setTimeout(retry, 500); const go = () => retry();"), /let retry = \(\) => setTimeout\(retry, 500\);/);
  const later = server("const api: { close?: () => void } = {}; api.close = () => stop(); const stop = () => n.set(0); const go = () => api.close!();");
  assert.match(later, /api\.close = \(\) => stop\(\);/);
});

// Fix round 2 (M1b, L1): out-of-order creation — a hoisted helper called before the declarator, a jump into another case.
test("a holder function inside a hoisted function declaration, or in another switch case than its capture, stays plain", () => {
  const hoisted = server(
    "const api: { close?: () => void } = {}; setup(); const stop = () => n.set(0); function setup() { api.close = () => stop(); } const go = () => api.close!();",
  );
  assert.match(hoisted, /api\.close = \(\) => stop\(\);/);
  const cases = server(
    "const h: { f?: () => number } = {}; switch (n()) { case 1: let y = 1; void y; break; case 2: h.f = () => y; } const go = () => h.f!();",
  );
  assert.match(cases, /h\.f = \(\) => y;/);
});

test("anchor: a callback passed to a call outside the consumed lists is wrapped in the same holder position", () => {
  const code = server("const t = Object.freeze(() => n.set(1)); const r = requestAnimationFrame(() => n.set(2)); const go = () => (t(), r);");
  assert.ok(wrapped(code, String.raw`\(\) => n\.set\(1\)`));
  assert.ok(!wrapped(code, String.raw`\(\) => n\.set\(2\)`));
});

test("a capture declared earlier in the same switch case is initialized: the holder function is wrapped", () => {
  const code = server("const h: { f?: () => number } = {}; switch (n()) { case 1: { break; } case 2: let y = 2; h.f = () => y; } const go = () => h.f!();");
  assert.match(code, new RegExp(String.raw`h\.f = __rivetR_fn\(${ID}, \(\) => y, \[y\]\)`));
});

// Lane LIVE-PROPS P4: resumable-symbol registration of functions / getter objects escaping as values (server resume
// output: `_rFn` wraps them, so a resumed capture serializes the recipe instead of failing / snapshotting).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const server = (source: string) => {
  const r = compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } } as never);
  assert.deepEqual(r.diagnostics, []);
  return r.code.replace(/\s+/g, " ");
};
const child = `function Hit(props: any) { return <button onClick={() => props.read()}>x</button>; }\n`;

test("gap 2a: a const arrow escaping through a conditional alias is a symbol (prop value and captured value)", () => {
  const prop = server(child + `export function A(props: any) { const read = () => 1; const value = props.live ? read : read(); return <Hit read={value} />; }`);
  assert.match(prop, /const read = __rivetR_fn\("src\/a\.tsx#A\$\w+", \(\) => 1, \[\]\);/);
  const captured = server(
    `export function B(props: any) { const f = () => 1; const g = () => 2; const pick = props.live ? f : g; return <button onClick={() => pick()}>x</button>; }`,
  );
  assert.match(captured, /const f = __rivetR_fn\("src\/a\.tsx#B\$\w+", \(\) => 1, \[\]\);/);
  assert.match(captured, /const g = __rivetR_fn\("src\/a\.tsx#B\$\w+", \(\) => 2, \[\]\);/);
});

test("gap 2b: a function passed to a local / relative helper is a symbol; method and library calls are not", () => {
  const code = server(
    `import { untrack } from "@rivetjs/reactivity";\nimport { helper } from "./h.tsx";\nfunction plus(compute: () => number) { return () => compute() + 1; }\n` +
      `export function C(props: any) { const a = plus(() => props.n * 10); const b = helper(() => props.n); const c = [1].map((x) => x + props.n); const d = untrack(() => props.n); return <button onClick={() => a() + b() + c[0] + d}>x</button>; }`,
  );
  assert.match(code, /plus\(__rivetR_fn\("src\/a\.tsx#C\$\w+", \(\) => props\.n \* 10, \[props\]\)\)/);
  assert.match(code, /helper\(__rivetR_fn\("src\/a\.tsx#C\$\w+", \(\) => props\.n, \[props\]\)\)/);
  assert.match(code, /\[1\]\.map\(\(x\) => x \+ props\.n\)/);
  // A local function passed by name is a symbol too.
  const named = server(
    `function plus(compute: () => number) { return () => compute() + 1; }\nexport function E(props: any) { const f = () => props.n; const a = plus(f); return <button onClick={() => a()}>x</button>; }`,
  );
  assert.match(named, /const f = __rivetR_fn\("src\/a\.tsx#E\$\w+", \(\) => props\.n, \[props\]\);/);
  assert.match(code, /untrack\(\(\) => props\.n\)/);
});

test("gap 2c: a getter object literal in a conditional initializer is a symbol", () => {
  const code = server(
    `import { createContext, useContext } from "@rivetjs/reactivity";\nimport { Provider } from "@rivetjs/runtime/dom";\nconst Ctx = createContext({ x: 0 });\n` +
      `function R() { const c = useContext(Ctx); return <p>{String(c.x)}</p>; }\nexport function D(props: any) { const value = props.live ? { get x() { return props.v; } } : { x: 1 }; return <Provider token={Ctx} value={value}><R /></Provider>; }`,
  );
  assert.match(code, /const value = __rivetR_fn\("src\/a\.tsx#D\$\w+", props\.live \?/);
});

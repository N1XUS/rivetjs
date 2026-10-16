// Destructuring defaults that are function literals (`const { f = () => x } = o`, `({ f = () => x })`)
// are resume Fn sites (rt-default-fn 2026-10-08): the server wraps the default in `_rFn` in place, so a
// handler / region capturing `f` serializes it. Before, handler captures threw "function is not
// serializable" and region locals silently lost the default (ColorThumb handlers dead after resume).
// Non-function defaults stay values.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/p.tsx" };

test("resume: function-literal destructuring default captured by a handler becomes an _rFn site", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page(props) {
  const n = signal(0);
  const { isSnapping = () => false, move, size = 1 } = props.ctx;
  return <button onClick={() => { if (!isSnapping()) move(n() + size); n.set(n() + 1); }}>{n()}</button>;
}`;
  const server = compile(source, { target: "server", filename: "p.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /const \{ isSnapping = __rivetR_fn\("src\/p\.tsx#Page\$\w+", \(\) => false, \[\]\), move, size = 1 \} = props\.ctx;/);
  assert.equal([...server.code.matchAll(/size = __rivetR_fn/g)].length, 0);
});

test("resume: function-literal parameter default capturing a prop becomes an _rFn site", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function C({ base, onX = () => base() + 1 }) {
  const n = signal(0);
  return <button onClick={() => n.set(onX())}>{n()}</button>;
}`;
  const server = compile(source, { target: "server", filename: "p.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /onX = __rivetR_fn\("src\/p\.tsx#C\$\w+", \(\) => base\(\) \+ 1, \[base\]\)/);
});

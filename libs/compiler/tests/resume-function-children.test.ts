// A function child of a native element (`{() => log().join()}`) is a resume `bind` site: the server
// wraps it in `_rBind` (the runtime calls the function under tracking), the symbol binds the body.
// Block bodies with a call (`{() => { return log().length; }}`, rt-block-function-child 2026-10-08) bind
// too: the symbol returns the function, which the DOM insert binds as a nested accessor.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const source = `import { signal } from "@rivetjs/reactivity";
export function Log() {
  const log = signal([]);
  return <div>
    <p>{() => log().join(", ")}</p>
    <ol>{() => log().map((e) => <li>{e}</li>)}</ol>
    <p>{() => "static"}</p>
    <p>{() => { return log().length; }}</p>
  </div>;
}`;
const resume = { module: "src/log.tsx" };

test("resume: parameterless arrow children with calls bind (concise and block bodies); others stay values", () => {
  const server = compile(source, { target: "server", filename: "log.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetR_bind\("src\/log\.tsx#Log\$\w+", \(\) => \(\) => log\(\)\.join\(", "\), \[log\]\)/);
  assert.match(server.code, /__rivetR_bind\("src\/log\.tsx#Log\$\w+", \(\) => \(\) => log\(\)\.map/);
  assert.match(server.code, /__rivetR_bind\("src\/log\.tsx#Log\$\w+", \(\) => \(\) => \{\s*return log\(\)\.length;\s*\}, \[log\]\)/);
  assert.equal([...server.code.matchAll(/__rivetR_bind\(/g)].length, 3);
  const dom = compile(source, { target: "dom", filename: "log.tsx", resume });
  const binds = dom.symbols!.filter((symbol) => symbol.kind === "bind");
  assert.equal(binds.length, 3);
  assert.equal(binds[0]!.source, 'export const Log$oi2 = (log) => () => (log().join(", "));\n');
  assert.match(binds[1]!.source, /^export const Log\$\w+ = \(log\) => \(\) => \(log\(\)\.map\(/);
  assert.equal(binds[2]!.source, "export const " + binds[2]!.name + " = (log) => () => (() => { return log().length; });\n");
});

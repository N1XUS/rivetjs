// T9: source maps — hot rewrite of an anonymous default function keeps columns; resume capture
// arrays map each identifier to its binding instead of the enclosing node.
import { test } from "vitest";
import assert from "node:assert/strict";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { compile } from "../index.ts";
import { hotModule } from "../hot.ts";

test("hotModule: an anonymous `export default function` keeps every column (same-width rewrite)", () => {
  for (const head of ["export default function (props) {", "export default function(props) {", "export default function   (props) {"]) {
    const code = `${head}\n  return props;\n}\n`;
    const out = hotModule(code, "m")!;
    const line = out.split("\n")[0]!;
    assert.equal(line.length, head.length, JSON.stringify(line));
    assert.equal(line.indexOf("(props)"), head.indexOf("(props)"));
    assert.match(line, /function __rivetDefault\s*\(props\)/);
  }
});

test("resume capture arrays: each identifier maps to its binding", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Counter({ step }) {
  const count = signal(0);
  return <button onClick={() => count.set(count() + step)}>{count()}</button>;
}
`;
  const result = compile(source, { filename: "c.tsx", target: "server", resume: { module: "c.tsx" }, sourceMap: true });
  assert.deepEqual(result.diagnostics, []);
  const map = new TraceMap(result.map!);
  const lines = result.code.split("\n");
  const origin = (name: string) => {
    const at = source.split("\n").findIndex((l) => new RegExp(`(?:const |\\{ )${name}\\b`).test(l));
    return { line: at + 1, column: source.split("\n")[at]!.search(new RegExp(`\\b${name}\\b`)) };
  };
  let checked = 0;
  lines.forEach((text, i) => {
    for (const array of text.matchAll(/\[((?:count|step)(?:, (?:count|step))*)\]/g))
      for (const id of array[1]!.matchAll(/count|step/g)) {
        const column = array.index! + 1 + id.index!;
        const found = originalPositionFor(map, { line: i + 1, column });
        assert.deepEqual({ line: found.line, column: found.column }, origin(id[0]), `${id[0]} at ${i + 1}:${column}`);
        checked++;
      }
  });
  assert.ok(checked >= 3, `checked ${checked} capture identifiers`);
});

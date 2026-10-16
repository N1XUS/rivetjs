// Source maps: `sourceMap: true` changes no emitted code and maps generated positions back to the
// original TSX (copied source exactly, lowered JSX to its element).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile, type CompileOptions } from "../index.ts";

const corpus = readFileSync(new URL("../oracle/corpus.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { kind: string; args: [string, CompileOptions?] })
  .filter((entry) => entry.kind === "compile");

test("every corpus case: identical code and diagnostics with maps on", () => {
  for (const { args } of corpus) {
    const [source, options = {}] = args;
    const plain = compile(source, options);
    const mapped = compile(source, { ...options, sourceMap: true });
    assert.equal(mapped.code, plain.code, String(options.filename));
    assert.deepEqual(mapped.diagnostics, plain.diagnostics);
    assert.deepEqual(mapped.symbols, plain.symbols);
    if (!plain.diagnostics.length && plain.code) assert.ok(mapped.map, "map for " + options.filename);
  }
  assert.ok(corpus.length > 100);
});

// Minimal VLQ decoder: generated [line, column] → original [line, column].
function decode(mappings: string): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let srcLine = 0,
    srcCol = 0;
  mappings.split(";").forEach((line, dstLine) => {
    let dstCol = 0;
    for (const segment of line.split(",").filter(Boolean)) {
      const values: number[] = [];
      let value = 0,
        shift = 0;
      for (const c of segment) {
        const digit = chars.indexOf(c);
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          values.push(value & 1 ? -(value >> 1) : value >> 1);
          value = shift = 0;
        }
      }
      dstCol += values[0]!;
      if (values.length >= 4) {
        srcLine += values[2]!;
        srcCol += values[3]!;
        out.push([dstLine, dstCol, srcLine, srcCol]);
      }
    }
  });
  return out;
}
const position = (text: string, needle: string): [number, number] => {
  const i = text.indexOf(needle);
  assert.ok(i >= 0, needle);
  const before = text.slice(0, i).split("\n");
  return [before.length - 1, before.at(-1)!.length];
};
const lookup = (code: string, map: string, needle: string): [number, number] | undefined => {
  const [line, column] = position(code, needle);
  return decode((JSON.parse(map) as { mappings: string }).mappings)
    .find(([l, c]) => l === line && c === column)
    ?.slice(2) as [number, number] | undefined;
};

const source = `import { signal } from "@rivetjs/reactivity";
type Props = { label: string };
export function Counter({ label }: Props) {
  const count = signal(0);
  const label2 = "é" + label;
  return (
    <button onClick={() => count.update((n) => n + 1)}>
      {label2}: {count()}
    </button>
  );
}
export const total = (a: number, b: number) => a + b;
`;

for (const target of ["dom", "server"] as const)
  test(`${target}: copied code maps exactly; lowered JSX maps to its element`, () => {
    const { code, map } = compile(source, { target, filename: "src/counter.tsx", sourceMap: true });
    assert.ok(map);
    const json = JSON.parse(map) as { version: number; sources: string[]; sourcesContent: string[] };
    assert.equal(json.version, 3);
    assert.deepEqual(json.sources, ["src/counter.tsx"]);
    assert.equal(json.sourcesContent[0], source);
    assert.deepEqual(lookup(code, map, "total = "), position(source, "total = "));
    assert.deepEqual(lookup(code, map, "count = signal"), position(source, "count = signal"));
    // After a non-ASCII string: columns count UTF-16 units.
    assert.deepEqual(lookup(code, map, "label2 = "), position(source, "label2 = "));
    // The handler body is copied into the lowered DOM output (the server drops handler literals, S6).
    if (target === "dom") assert.deepEqual(lookup(code, map, "count.update"), position(source, "count.update"));
    else assert.doesNotMatch(code, /count\.update/);
  });

test("sources containing the mark character compile without a map", () => {
  const result = compile('export const s = "";', { sourceMap: true });
  assert.equal(result.map, undefined);
  assert.match(result.code, //);
});

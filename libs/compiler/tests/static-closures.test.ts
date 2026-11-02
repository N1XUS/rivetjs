// Manifest `deps` closures (`vite.ts` `staticClosures`, compiler#13): memoised per strongly connected component, equal to a
// plain per-root walk on graphs with cycles and self-imports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { staticClosures } from "../vite.ts";

const walk = (edges: Map<string, string[]>, file: string): string[] => {
  const seen = new Set<string>(),
    stack = [...(edges.get(file) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next) || next === file) continue;
    seen.add(next);
    stack.push(...(edges.get(next) ?? []));
  }
  return [...seen].sort();
};

test("staticClosures equals the per-root walk on random graphs with cycles", () => {
  let seed = 11;
  const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  for (let round = 0; round < 200; round++) {
    const size = 2 + rand(14);
    const edges = new Map<string, string[]>();
    for (let i = 0; i < size; i++)
      edges.set(
        "n" + i,
        Array.from({ length: rand(4) }, () => "n" + rand(size + 1)),
      ); // n<size>: not a chunk
    const reach = staticClosures((name) => edges.get(name) ?? []);
    for (const file of edges.keys()) {
      const got = new Set(reach(file));
      got.delete(file);
      assert.deepEqual([...got].sort(), walk(edges, file), JSON.stringify([...edges]) + " " + file);
    }
  }
});

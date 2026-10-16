import { test } from "vitest";
import assert from "node:assert/strict";
import { transform } from "esbuild";
import { MAX_MAPS, appFrame, editorPath, inlineMap, locate, lookup, parseStack } from "../agent/source.ts";

test("V8 and SpiderMonkey frames parse; framework frames are skipped", () => {
  const frames = parseStack(
    [
      "Error: created",
      "    at signal (http://localhost:5173/@fs/repo/libs/reactivity/dev.ts:40:9)",
      "    at signal (http://localhost:5173/@fs/repo/libs/runtime/hot.ts:80:3)",
      "    at Counter (http://localhost:5173/src/routes/index.tsx?t=1:12:15)",
      "    at http://localhost:5173/src/main.tsx:3:1",
      "Layout@http://localhost:5173/src/routes/_layout.tsx:7:20",
    ].join("\n"),
  );
  assert.deepEqual(
    frames.map((f) => [f.fn, f.line, f.col]),
    [["signal", 40, 9], ["signal", 80, 3], ["Counter", 12, 15], ["", 3, 1], ["Layout", 7, 20]],
  );
  assert.equal(appFrame(frames)!.fn, "Counter");
  assert.equal(appFrame(parseStack("    at x (http://h/node_modules/.vite/deps/a.js:1:1)")), undefined);
});

test("editor paths: root-relative for served files, absolute for /@fs/", () => {
  assert.equal(editorPath("http://h/src/routes/index.tsx?t=1"), "src/routes/index.tsx");
  assert.equal(editorPath("http://h/@fs/Users/me/app/x.tsx"), "/Users/me/app/x.tsx");
  assert.equal(editorPath("http://h/src/a%20b.tsx"), "src/a b.tsx");
});

test("inline source maps map generated positions back to the source", async () => {
  const source = ["type T = number;", "", "export function make(): Error {", "  const n: T = 1;", "  return new Error(String(n));", "}", ""].join("\n");
  const { code } = await transform(source, { loader: "ts", sourcemap: "inline", sourcefile: "make.ts" });
  const lines = code.split("\n");
  const line = lines.findIndex((l) => l.includes("new Error")) + 1;
  const col = lines[line - 1]!.indexOf("new Error") + 1;
  const map = inlineMap(code)!;
  assert.deepEqual(map.sources, ["make.ts"]);
  assert.deepEqual(lookup(map, line, col), { source: "make.ts", line: 5, col: 10 });
  const fetched: string[] = [];
  const location = await locate({ fn: "make", url: "http://h/src/make.ts?t=2", line, col }, async (url) => (fetched.push(url), code));
  assert.deepEqual(location, { file: "src/make.ts", line: 5, col: 10 });
  // One fetch per module; unmapped modules keep their served position.
  await locate({ fn: "make", url: "http://h/src/make.ts?t=2", line, col }, async () => assert.fail("fetched twice"));
  assert.deepEqual(fetched, ["http://h/src/make.ts?t=2"]);
  assert.deepEqual(await locate({ fn: "", url: "http://h/src/plain.js", line: 3, col: 4 }, async () => "plain()"), { file: "src/plain.js", line: 3, col: 4 });
});

test("source map cache: one entry per module across HMR stamps, LRU-capped, same origin only", async () => {
  const fetched: string[] = [];
  const fetchText = async (url: string) => (fetched.push(url), "x()");
  const at = (url: string) => locate({ fn: "", url, line: 1, col: 1 }, fetchText);
  await at("http://h/src/hmr.ts?t=1");
  await at("http://h/src/hmr.ts?t=1");
  // A newer stamp refetches (new code); an older one reuses the entry (the server serves current code).
  await at("http://h/src/hmr.ts?t=5");
  await at("http://h/src/hmr.ts?t=3");
  assert.deepEqual(fetched, ["http://h/src/hmr.ts?t=1", "http://h/src/hmr.ts?t=5"]);
  // Bounded: the least recently used module is dropped past MAX_MAPS.
  fetched.length = 0;
  for (let i = 0; i <= MAX_MAPS; i++) await at("http://h/src/m" + i + ".ts");
  await at("http://h/src/m" + MAX_MAPS + ".ts");
  await at("http://h/src/m0.ts");
  assert.equal(fetched.length, MAX_MAPS + 2, "m0 evicted and refetched, the newest kept");
  // Cross-origin frames (CDN scripts) are never fetched.
  const g = globalThis as { location?: { origin: string } };
  const saved = g.location;
  g.location = { origin: "http://h" };
  try {
    const location = await locate({ fn: "", url: "https://cdn.example/lib.js", line: 2, col: 3 }, async () => assert.fail("fetched a third-party script"));
    assert.deepEqual(location, { file: "lib.js", line: 2, col: 3 });
    await at("http://h/src/same.ts");
    assert.equal(fetched.at(-1), "http://h/src/same.ts");
  } finally {
    if (saved) g.location = saved;
    else delete g.location;
  }
});

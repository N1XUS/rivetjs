// INCR-BUILD persistent compiler cache (`wasm.ts` `setCallCache`, `rivet({ compileCache })`): hits answer with the same
// result, any request / table change misses, eviction keeps the directory under its cap, and a Vite build whose module
// facts changed in ANOTHER module (cross-module verdicts are compile options) is byte-identical to a build without cache.
import { afterAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { build } from "vite";
import { compile, moduleFacts, registerTable } from "../index.ts";
import { callCacheStats, pruneCallCache, setCallCache } from "../wasm.ts";
import { rivet } from "../vite.ts";

const roots: string[] = [];
afterAll(async () => {
  setCallCache(null);
  for (const root of roots) await rm(root, { recursive: true, force: true });
});
async function tempDir(name: string): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/" + name + "-"));
  roots.push(dir);
  return dir;
}
const snapshot = () => ({ ...callCacheStats });
const delta = (before: typeof callCacheStats) => ({
  hits: callCacheStats.hits - before.hits,
  misses: callCacheStats.misses - before.misses,
  writes: callCacheStats.writes - before.writes,
});

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Counter() {
  const n = signal(0);
  return <button onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;

test("hit returns the stored result; source, options and target changes miss", async () => {
  const dir = await tempDir("call-cache-unit");
  setCallCache(null);
  const fresh = compile(SOURCE, { target: "dom", filename: "/x/counter.tsx" });
  setCallCache(join(dir, "c"));
  let before = snapshot();
  const first = compile(SOURCE, { target: "dom", filename: "/x/counter.tsx" });
  assert.deepEqual(delta(before), { hits: 0, misses: 1, writes: 1 });
  before = snapshot();
  const second = compile(SOURCE, { target: "dom", filename: "/x/counter.tsx" });
  assert.deepEqual(delta(before), { hits: 1, misses: 0, writes: 0 });
  assert.deepEqual(second, first);
  assert.deepEqual(second, fresh);
  before = snapshot();
  compile(SOURCE + "\n", { target: "dom", filename: "/x/counter.tsx" });
  compile(SOURCE, { target: "server", filename: "/x/counter.tsx" });
  compile(SOURCE, { target: "dom", filename: "/x/other.tsx" });
  moduleFacts(SOURCE, "/x/counter.tsx", { boundaries: true });
  assert.equal(delta(before).hits, 0);
  assert.equal(delta(before).misses, 4);
  // Facts answered from the cache equal a fresh answer (Maps rebuilt from the same JSON).
  before = snapshot();
  const facts = moduleFacts(SOURCE, "/x/counter.tsx", { boundaries: true });
  assert.equal(delta(before).hits, 1);
  setCallCache(null);
  assert.deepEqual(facts, moduleFacts(SOURCE, "/x/counter.tsx", { boundaries: true }));
});

test("a registered static-call table is part of the key", async () => {
  const dir = await tempDir("call-cache-tables");
  setCallCache(join(dir, "c"));
  const source = `export const a = 1;\n`;
  compile(source, { target: "dom", filename: "/x/t.tsx" });
  let before = snapshot();
  compile(source, { target: "dom", filename: "/x/t.tsx" });
  assert.equal(delta(before).hits, 1);
  registerTable("call-cache-test", { k: [] });
  before = snapshot();
  compile(source, { target: "dom", filename: "/x/t.tsx" });
  assert.deepEqual(delta(before), { hits: 0, misses: 1, writes: 1 });
  setCallCache(null);
});

test("errors are not stored; a torn entry is recomputed", async () => {
  const dir = await tempDir("call-cache-torn");
  const cache = join(dir, "c");
  setCallCache(cache);
  compile(SOURCE, { target: "dom", filename: "/x/torn.tsx" });
  const subs = (await readdir(cache)).filter((name) => !name.startsWith("."));
  const files: string[] = [];
  for (const sub of subs) for (const name of await readdir(join(cache, sub))) files.push(join(cache, sub, name));
  assert.equal(files.length, 1);
  await writeFile(files[0]!, '{"ok":');
  const before = snapshot();
  const result = compile(SOURCE, { target: "dom", filename: "/x/torn.tsx" });
  assert.deepEqual(delta(before), { hits: 0, misses: 1, writes: 1 });
  assert.ok(result.code.length > 0);
  assert.ok(JSON.parse(await readFile(files[0]!, "utf8")).ok);
  setCallCache(null);
});

test("pruning drops least recently used entries down to 80 % of the cap", async () => {
  const dir = await tempDir("call-cache-prune");
  await mkdir(join(dir, "ab"), { recursive: true });
  for (let i = 0; i < 10; i++) {
    const file = join(dir, "ab", `${i}.json`);
    await writeFile(file, "x".repeat(100));
    const time = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    await utimes(file, time, time);
  }
  // 1000 bytes over a 600 byte cap → keep ≤ 480: the four newest.
  assert.equal(pruneCallCache(dir, 600, true), 6);
  assert.deepEqual((await readdir(join(dir, "ab"))).sort(), ["6.json", "7.json", "8.json", "9.json"]);
  // Under the cap: nothing goes; a fresh stamp skips the scan.
  assert.equal(pruneCallCache(dir, 600, true), 0);
  assert.equal(pruneCallCache(dir, 1), 0);
  assert.ok((await stat(join(dir, ".pruned"))).isFile());
});

const COUNTER = (interactive: boolean) => `import { signal } from "@rivetjs/reactivity";
export function Counter(props) {
  const n = signal(props.start);
  return <button type="button"${interactive ? " onClick={() => n.set(n() + 1)}" : ""}>{n()}</button>;
}
`;
const PAGE = `import { Counter } from "./counter.tsx";
function Shell(props) {
  return <section>{props.children}</section>;
}
export default function Page() {
  return <main><Shell><Counter start={1} /></Shell><p>text</p></main>;
}
`;

async function tree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (at: string) => {
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await walk(path);
      else out[relative(dir, path)] = await readFile(path, "utf8");
    }
  };
  await walk(dir);
  return out;
}

async function buildBoth(root: string, cacheDir: string, compileCache: boolean): Promise<Record<string, string>> {
  const plugin = () => rivet({ serverExports: { modules: ["src/page.tsx"] }, resume: { modules: ["src/page.tsx", "src/counter.tsx"] }, compileCache });
  const common = { root, configFile: false as const, logLevel: "silent" as const, cacheDir };
  await rm(resolve(root, "out"), { recursive: true, force: true });
  await build({ ...common, plugins: [plugin()], build: { outDir: "out/client", manifest: true, rollupOptions: { input: "src/page.tsx" } } });
  await build({ ...common, plugins: [plugin()], build: { outDir: "out/server", ssr: "src/page.tsx" } });
  return tree(resolve(root, "out"));
}

test("a fact change in another module: warm cached build = uncached build, unchanged modules hit", async () => {
  const root = await tempDir("call-cache-vite");
  const cacheDir = join(root, "vite-cache");
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/page.tsx"), PAGE);
  await writeFile(resolve(root, "src/counter.tsx"), COUNTER(true));
  // Cold (fills the cache), then warm: same output, compiler answered from the cache.
  const cold = await buildBoth(root, cacheDir, true);
  let before = snapshot();
  const warm = await buildBoth(root, cacheDir, true);
  assert.deepEqual(warm, cold);
  assert.equal(delta(before).misses, 0);
  assert.ok(delta(before).hits > 0);
  // The counter loses its handler: no longer a boundary, so the page's verdicts (its compile options) change although
  // page.tsx did not. The cached build must equal a build without the cache.
  await writeFile(resolve(root, "src/counter.tsx"), COUNTER(false));
  before = snapshot();
  const edited = await buildBoth(root, cacheDir, true);
  assert.ok(delta(before).misses > 0);
  const uncached = await buildBoth(root, join(root, "vite-cache-off"), false);
  assert.deepEqual(edited, uncached);
  assert.notDeepEqual(edited, cold);
});

// Read-only artifact gate; the runner's full --verify remains the behavioral authority.
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { items } from "../../data.ts";
import { serve } from "../../serve.ts";
import { chromeTarget } from "../../../../scripts/bench/shared.ts";

type Boundary = [id: number, parent: number, flags: number, name: string, values: unknown[], props?: object];
interface Tail {
  v: number;
  b: Boundary[];
  m: Record<string, string>;
}

/** Inspect a built fixture without rebuilding, rewriting, or resuming it. Imports use a real browser DOM. */
export async function checkBootstrap(directory: string): Promise<void> {
  const dir = resolve(directory);
  const html = await readFile(resolve(dir, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)\btype="rivet\/boundaries"([^>]*)>(.*?)<\/script>/gs)];
  assert.equal(scripts.length, 1, "expected one rivet/boundaries tail");
  const script = scripts[0]!;
  const attributes = script[1]! + script[2]!;
  const tail = JSON.parse(script[3]!) as Tail;
  assert.equal(tail.v, 1, "unsupported boundary tail version");
  assert(Array.isArray(tail.b) && tail.b.length > 0, "missing boundaries");
  assert(tail.m && typeof tail.m === "object" && !Array.isArray(tail.m), "missing module mapping");
  const roots = tail.b.filter((boundary) => boundary[1] === 0);
  assert.equal(roots.length, 1, "expected one independent root");
  const root = roots[0]!;
  // Tail v1: 1 = independent; 8 = independence demoted by non-data props.
  assert((root[2] & 1) !== 0 && (root[2] & 8) === 0, "root must be independent");
  assert.equal(root[3], "root.tsx#default", "expected data-only Root boundary");
  assert.deepEqual(root[5], { items, initialUrl: "http://bench.local/" }, "root props must retain only fixture items and initialUrl");

  const boundaries = new Map<number, Boundary>();
  for (const boundary of tail.b) {
    assert(Number.isInteger(boundary[0]) && boundary[0] > 0 && !boundaries.has(boundary[0]), "invalid or duplicate boundary id");
    boundaries.set(boundary[0], boundary);
  }
  for (const boundary of tail.b) {
    const seen = new Set<number>();
    let current = boundary;
    while (current[1] !== 0) {
      assert(!seen.has(current[0]), `boundary parent cycle: ${boundary[3]}`);
      seen.add(current[0]);
      const parent = boundaries.get(current[1]);
      assert(parent, `orphan boundary: ${boundary[3]}`);
      current = parent;
    }
    assert.equal(current, root, `orphan dependent root: ${boundary[3]}`);
    assert(Object.hasOwn(tail.m, boundary[3]), `missing module mapping: ${boundary[3]}`);
  }

  async function asset(url: string): Promise<void> {
    assert(typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !/[?#\\]/.test(url), `invalid required asset: ${url}`);
    const file = resolve(dir, "." + decodeURIComponent(url));
    assert(file.startsWith(dir + sep), `required asset escapes output: ${url}`);
    assert(
      await stat(file).then(
        (entry) => entry.isFile(),
        () => false,
      ),
      `missing required asset: ${url}`,
    );
  }
  for (const url of Object.values(tail.m)) await asset(url);
  const runtime = /\bdata-rt="([^"]+)"/.exec(attributes)?.[1];
  assert(runtime, "missing runtime required asset");
  await asset(runtime);
  const preloads = /\bdata-fo="([^"]+)"/.exec(attributes)?.[1];
  assert(preloads, "missing preload required assets");
  for (const url of preloads.trim().split(/\s+/)) await asset(url);
  // Include lazy chunks not instantiated in the initial tail, as well as shared dependencies.
  const manifest = JSON.parse(await readFile(resolve(dir, "build-manifest.json"), "utf8")) as { artifacts: { path: string }[] };
  assert(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0, "missing artifact manifest");
  for (const entry of manifest.artifacts) await asset("/" + entry.path);

  const server = await serve(dir);
  try {
    const browser = await chromium.launch({ ...chromeTarget(), headless: true });
    try {
      const page = await browser.newPage();
      // A same-origin 404 document supplies a real DOM without running the fixture's loader/effects.
      await page.goto(server.url + "/__bootstrap_check__");
      for (const [name, url] of Object.entries(tail.m)) {
        const exportName = name.slice(name.lastIndexOf("#") + 1);
        assert(name.includes("#") && exportName, `invalid boundary name: ${name}`);
        const callable = await page.evaluate(
          async ({ url, exportName }) => {
            const module = await import(url);
            return Object.hasOwn(module, exportName) && typeof module[exportName] === "function";
          },
          { url, exportName },
        );
        assert(callable, `missing callable export: ${name} in ${url}`);
      }
      console.log(`bootstrap ok: ${tail.b.length} boundaries, ${Object.keys(tail.m).length} callable exports (chrome ${browser.version()})`);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert(process.argv.length === 3, "usage: node apps/resume-bench/lanes/rivet/check-bootstrap.ts <built-rivet-dir>");
    await checkBootstrap(process.argv[2]!);
  } catch (error) {
    console.error(`bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

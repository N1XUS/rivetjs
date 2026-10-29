// Build-time evaluation (`comptime.ts`): constant calls fold to their result, `tv(…)` definitions to proven lookup
// tables, override-free call sites read the table (tailwind-merge leaves the bundle), overrides keep the real merge,
// non-deterministic functions are refused (RV2108), dev keeps every call, results are cached on disk.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { cn } from "tailwind-variants";
import { tv } from "tailwind-variants";
import { comptimeAnnotations } from "../comptime.ts";
import { rivet } from "../vite.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
let root = "";
let cacheRoot = "";
const savedCacheRoot = process.env.RIVET_CACHE_DIR;

beforeAll(async () => {
  // Inside the workspace: the fixture resolves tailwind-variants and @rivetjs/runtime like an app.
  root = await mkdtemp(join(here, ".comptime-"));
  // Results go to `rivetCacheDir()/comptime`, never the project (Tailwind source detection scans the app dir).
  cacheRoot = await mkdtemp(join(tmpdir(), "rivet-comptime-test-"));
  process.env.RIVET_CACHE_DIR = cacheRoot;
  await writeFile(
    join(root, "styles.ts"),
    `import { tv, type VariantProps } from "tailwind-variants";
export const button = tv({
  base: "inline-flex px-2",
  variants: { size: { sm: "text-sm px-3", lg: "text-lg px-5" }, primary: { true: "bg-blue-500", false: "bg-white" } },
  defaultVariants: { size: "sm" },
});
export const card = tv({
  slots: { root: "rounded border", title: "font-bold" },
  variants: { tone: { muted: { root: "bg-gray-100", title: "text-gray-500" }, loud: { root: "bg-red-500" } } },
});
// A type position is not a resolver use (the table module must not import the merge).
export type ButtonVariants = VariantProps<typeof button>;
`,
  );
  await writeFile(
    join(root, "helpers.ts"),
    `/** Joins words. @comptime */
export function words(...parts: string[]): string { return parts.join("-"); }
/** @comptime */
export function stamp(): number { return Date.now(); }
`,
  );
  // Override-free sites only: the core path.
  await writeFile(
    join(root, "core.ts"),
    `import { button, card } from "./styles.ts";
import { cn } from "tailwind-variants";
import { words } from "./helpers.ts";
export const fixed = button({ size: "lg" });
export const joined = cn("px-2", "px-4");
export const named = words("a", "b", "c");
export const dynamic = (size: string, primary: boolean) => button({ size, primary });
export const slot = (tone: string) => card({ tone }).title();
export const fixedSlot = card({ tone: "muted" }).root();
`,
  );
  // A user override: the full resolver (tailwind-merge) stays.
  await writeFile(
    join(root, "override.ts"),
    `import { button } from "./styles.ts";\nexport const over = (cls: string) => button({ size: "lg", class: cls });\n`,
  );
  // A definition module with a stylesheet (like `@rivetjs/ui`'s): a constant site must keep it reachable.
  // A package like `@rivetjs/ui`: only stylesheets have side effects.
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "comptime-fixture", type: "module", sideEffects: ["*.css"] }));
  await writeFile(join(root, "badge.css"), ".badge-marker { color: red; }\n");
  await writeFile(
    join(root, "badge.ts"),
    `import "./badge.css";\nimport { tv } from "tailwind-variants";\nexport const badge = tv({ base: "badge", variants: { tone: { a: "x", b: "y" } } });\n`,
  );
  await writeFile(join(root, "badged.ts"), `import { badge } from "./badge.ts";\nexport const cls = badge({ tone: "a" });\n`);
  // Defer mode: a `tv` wrapper whose `cn` import is `@comptime defer` (like `@rivetjs/ui`'s `tv.ts`).
  await writeFile(
    join(root, "defer-tv.ts"),
    `import { tv as lite } from "tailwind-variants/lite";
/** @comptime defer */
import { cn } from "tailwind-variants";
type P = Record<string, unknown> | undefined;
const has = (p: P) => p != null && ((p.class != null && p.class !== "") || (p.className != null && p.className !== ""));
const bare = (p: P) => ({ ...p, class: undefined, className: undefined });
/** @comptime tv */
export const tv = (options: Record<string, unknown>) => {
  const inner = lite(options as never) as unknown as (p?: P) => any;
  const f = options.slots
    ? (p?: P) => {
        const r = inner(p);
        const out: Record<string, (sp?: P) => string> = {};
        for (const k in r) out[k] = (sp?: P) => (has(sp) ? cn(r[k](bare(sp)), sp!.class as never, sp!.className as never) : r[k](sp));
        return out;
      }
    : (p?: P) => (has(p) ? cn(inner(bare(p)), p!.class as never, p!.className as never) : inner(p));
  return Object.assign(f, inner);
};
`,
  );
  await writeFile(
    join(root, "defer-styles.ts"),
    `import { tv } from "./defer-tv.ts";
export const chip = tv({ base: "chip px-2", variants: { size: { sm: "px-3", lg: "px-5" } } });
export const box = tv({ slots: { root: "box p-1", label: "lbl" }, variants: { tone: { a: { root: "ra" } } } });
`,
  );
  await writeFile(
    join(root, "defer-core.ts"),
    `import { chip, box } from "./defer-styles.ts";
export const a = (size?: "sm" | "lg") => chip({ size });
export const b = (tone?: "a") => box({ tone }).label();
`,
  );
  await writeFile(
    join(root, "defer-over.ts"),
    `import { chip, box } from "./defer-styles.ts";
export const o = (cls: string) => chip({ size: "lg", class: cls });
const slots = box();
export const p = (cls: string) => slots.root({ class: cls });
`,
  );
  // A definition this pass cannot read (non-literal options): its own module provides.
  await writeFile(join(root, "defer-dyn.ts"), `import { tv } from "./defer-tv.ts";\nconst opts = { base: "d px-1" };\nexport const dyn = tv(opts);\n`);
  await writeFile(join(root, "defer-dyn-use.ts"), `import { dyn } from "./defer-dyn.ts";\nexport const q = (cls: string) => dyn({ class: cls });\n`);
  await writeFile(join(root, "clock.ts"), `import { stamp } from "./helpers.ts";\nexport const at = stamp();\n`);
});
afterAll(async () => {
  if (savedCacheRoot === undefined) delete process.env.RIVET_CACHE_DIR;
  else process.env.RIVET_CACHE_DIR = savedCacheRoot;
  if (cacheRoot) await rm(cacheRoot, { recursive: true, force: true });
  if (root && !process.env.RIVET_KEEP_FIXTURE) await rm(root, { recursive: true, force: true });
});

const bundle = async (input: string, mode: "build" | "off" = "build", warnings: string[] = []) => {
  const out = (await build({
    root,
    configFile: false,
    logLevel: "silent",
    cacheDir: join(root, ".vite-cache"),
    plugins: [rivet({ devtools: false, comptime: mode === "build" })],
    build: {
      write: false,
      minify: false,
      lib: { entry: join(root, input), formats: ["es"], fileName: "out" },
      rollupOptions: { onwarn: (w) => void warnings.push(w.message) },
    },
  })) as Rollup.RollupOutput[] | Rollup.RollupOutput;
  const output = (Array.isArray(out) ? out[0]! : out).output;
  return output.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
};
const load = async (code: string) => import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("override-free sites read the table: tailwind-merge and the tv runtime leave the bundle, results match the library", async () => {
  const code = await bundle("core.ts");
  assert.doesNotMatch(code, /twMerge|createTailwindMerge|getTailwindVariants/, "no tailwind-merge / tv runtime");
  const mod = await load(code);
  const button = tv({
    base: "inline-flex px-2",
    variants: { size: { sm: "text-sm px-3", lg: "text-lg px-5" }, primary: { true: "bg-blue-500", false: "bg-white" } },
    defaultVariants: { size: "sm" },
  });
  const card = tv({
    slots: { root: "rounded border", title: "font-bold" },
    variants: { tone: { muted: { root: "bg-gray-100", title: "text-gray-500" }, loud: { root: "bg-red-500" } } },
  });
  assert.equal(mod.fixed, button({ size: "lg" }));
  assert.equal(mod.joined, cn("px-2", "px-4"));
  assert.equal(mod.named, "a-b-c");
  assert.equal(mod.fixedSlot, card({ tone: "muted" }).root());
  // Constant sites are literals in the output.
  assert.match(code, new RegExp(JSON.stringify(button({ size: "lg" })).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const size of ["sm", "lg", "xl", "", undefined, null] as const)
    for (const primary of [true, false, undefined] as const)
      assert.equal(mod.dynamic(size, primary), button({ size: size as never, primary }), `${size} ${primary}`);
  for (const tone of ["muted", "loud", "other", undefined] as const) assert.equal(mod.slot(tone), card({ tone: tone as never }).title(), String(tone));
});

test("a class override keeps the real merge (tailwind-merge in the bundle), with the library's output", async () => {
  const code = await bundle("override.ts");
  assert.match(code, /twMerge|createTailwindMerge|mergeClassList/);
  const mod = await load(code);
  const button = tv({
    base: "inline-flex px-2",
    variants: { size: { sm: "text-sm px-3", lg: "text-lg px-5" }, primary: { true: "bg-blue-500", false: "bg-white" } },
    defaultVariants: { size: "sm" },
  });
  for (const cls of ["px-9", "text-xs", "", "custom"]) assert.equal(mod.over(cls), button({ size: "lg", class: cls }), cls);
});

test("pages: the table's chunk never carries tailwind-merge; only the page with an override loads it", async () => {
  const out = (await build({
    root,
    configFile: false,
    logLevel: "silent",
    cacheDir: join(root, ".vite-cache"),
    plugins: [rivet({ devtools: false })],
    build: {
      write: false,
      minify: false,
      rollupOptions: { preserveEntrySignatures: "strict", input: { core: join(root, "core.ts"), over: join(root, "override.ts") } },
    },
  })) as Rollup.RollupOutput;
  const chunks = new Map(out.output.flatMap((c) => (c.type === "chunk" ? [[c.fileName, c] as const] : [])));
  const closure = (name: string): string => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const next of chunks.get(file)!.imports) walk(next);
    };
    walk([...chunks.values()].find((c) => c.isEntry && c.name === name)!.fileName);
    return [...seen].map((file) => chunks.get(file)!.code).join("\n");
  };
  const merge = /backdrop-brightness/; // tailwind-merge's class groups
  assert.doesNotMatch(closure("core"), merge);
  assert.match(closure("over"), merge);
});

test("a constant call of a definition whose module imports a stylesheet keeps the stylesheet", async () => {
  const out = (await build({
    root,
    configFile: false,
    logLevel: "silent",
    cacheDir: join(root, ".vite-cache"),
    plugins: [rivet({ devtools: false })],
    build: { write: false, minify: false, rollupOptions: { preserveEntrySignatures: "strict", input: join(root, "badged.ts") } },
  })) as Rollup.RollupOutput;
  const css = out.output.flatMap((o) => (o.type === "asset" && o.fileName.endsWith(".css") ? [String(o.source)] : [])).join("");
  assert.match(css, /badge-marker/);
  assert.equal((await load(await bundle("badged.ts"))).cls, "badge x");
});

const twm = /backdrop-brightness/; // tailwind-merge's class groups

test("defer mode: override-free pages ship no tailwind-merge, overrides get it, results equal the dev module", async () => {
  const dev = await import(join(root, "defer-styles.ts"));
  const core = await bundle("defer-core.ts");
  assert.doesNotMatch(core, twm);
  const c = await load(core);
  for (const size of ["sm", "lg", undefined] as const) assert.equal(c.a(size), dev.chip({ size }), String(size));
  assert.equal(c.b("a"), dev.box({ tone: "a" }).label());
  const over = await bundle("defer-over.ts");
  assert.match(over, twm);
  const o = await load(over);
  for (const cls of ["px-9", "", "x y px-1"]) {
    assert.equal(o.o(cls), dev.chip({ size: "lg", class: cls }), cls);
    assert.equal(o.p(cls), dev.box().root({ class: cls }), cls);
  }
  // An unread definition: its module imports the provider (no "did not see" throw).
  const dyn = await load(await bundle("defer-dyn-use.ts"));
  assert.equal(dyn.q("px-4"), (await import(join(root, "defer-dyn.ts"))).dyn({ class: "px-4" }));
});

test("a non-deterministic function is refused with RV2108 and stays a runtime call", async () => {
  const warnings: string[] = [];
  const code = await bundle("clock.ts", "build", warnings);
  assert.ok(
    warnings.some((w) => /RV2108/.test(w) && /Date/.test(w)),
    warnings.join("\n"),
  );
  assert.match(code, /stamp\(\)/);
});

test("comptime: false keeps every call; the disk cache holds the evaluated results", async () => {
  const off = await bundle("core.ts", "off");
  assert.match(off, /getTailwindVariants|twMerge/);
  const cached = await readdir(join(cacheRoot, "comptime"));
  assert.ok(cached.length >= 3, cached.join());
  // Nothing of it under the project or Vite's cacheDir.
  assert.deepEqual(await readdir(join(root, ".vite-cache")).catch(() => []), []);
  // A second build reads the cache (same output).
  assert.equal(await bundle("core.ts"), await bundle("core.ts"));
});

test("annotations", () => {
  assert.deepEqual(
    [
      ...comptimeAnnotations(
        "/** @comptime tv */\nexport const tv = 1;\n/** x\n * @comptime\n */\nexport function f() {}\n/** @comptimeX */ export const no = 1;",
      ),
    ],
    [
      ["tv", "tv"],
      ["f", "value"],
    ],
  );
});

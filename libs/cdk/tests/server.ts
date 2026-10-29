// Server-render cdk components in node tests: compile `.tsx` modules (and their `.tsx` imports) for
// the server in resume mode, point `.ts` imports at their files, render with `resumableToString`.
// Compiled modules are written to a per-process temp dir and imported by file URL. Never inline a dependency as a
// data URL inside its importer: every level re-embeds its whole subtree (base64), so a deep graph (date-picker)
// grew past 12 MB per URL and the module runner's copies of it past 4 GB.
// Import cycles between `.tsx` modules are allowed (`collections/components.tsx` → `#server` = `collections/server-on.tsx`
// → `./components.tsx`, SMALL-FIXES 2026-10-21): a module's file URL is allocated before it is built, so an importer
// never waits for its dependency's build; `serverModule` resolves once the module and everything it reaches are written.
// (Awaiting each dependency's build deadlocked on the cycle: a pending promise and an idle event loop, the cdk node
// suite stuck at `live-flags-ssr` with 0 % CPU and no test timeout, CI-RED-2.)
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import * as compiler from "@rivetjs/compiler";
import { resolveCdkSubpath } from "./resolve-subpath.ts";

const cdk = new URL("../", import.meta.url);
const runtime = [
  "@rivetjs/runtime/derived-eager",
  "@rivetjs/runtime/server-derived",
  "@rivetjs/runtime/server-resume",
  "@rivetjs/runtime/server",
  "@rivetjs/runtime/style",
  "@rivetjs/runtime/slot",
  "@rivetjs/runtime/resume-format",
  "@rivetjs/runtime/props",
  "@rivetjs/runtime/id",
  "@rivetjs/reactivity/store",
  "@rivetjs/reactivity",
];
const symbols: Record<string, string> = {};
/** A server-built module: its file (allocated up front), its build, and the modules its code imports. */
interface Built {
  file: string;
  url: string;
  written: Promise<void>;
  deps: Built[];
}
const cache = new Map<string, Built>();
let out: string | undefined;
let seq = 0;

/** Temp file (and its URL) for compiled module `name`. */
function allocate(name: string): { file: string; url: string } {
  if (!out) {
    const dir = (out = mkdtempSync(join(tmpdir(), "rivet-cdk-server-")));
    process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
  }
  const file = join(out, `${seq++}-${name.replace(/[^\w.-]+/g, "_")}.mjs`);
  return { file, url: pathToFileURL(file).href };
}

/** Write compiled module `code` to the temp dir; returns its file URL. */
function emit(name: string, code: string): string {
  const { file, url } = allocate(name);
  writeFileSync(file, code);
  return url;
}

/** The (started) server build of cdk module `name`, or of `source` when given. */
function serverBuild(name: string, source?: string): Built {
  const key = source ? `${name}\0${source}` : name;
  let built = cache.get(key);
  if (!built) {
    built = { ...allocate(name), written: undefined as unknown as Promise<void>, deps: [] };
    cache.set(key, built);
    built.written = build(built, name, source);
    built.written.catch(() => {}); // surfaced by `serverModule` (awaits every reachable build)
  }
  return built;
}

/** File URL of the server build of cdk module `name` (e.g. "modal.tsx"), or of `source` when given; resolves once it and
 *  every module it reaches are written (cycles included). */
export async function serverModule(name: string, source?: string): Promise<string> {
  const root = serverBuild(name, source);
  const seen = new Set<Built>();
  const queue = [root];
  for (let next; (next = queue.pop());)
    if (!seen.has(next)) {
      seen.add(next);
      await next.written;
      queue.push(...next.deps);
    }
  return root.url;
}

/** URL of dependency `name` of `importer` (its build may still run). */
function dependency(importer: Built, name: string): string {
  const dep = serverBuild(name);
  importer.deps.push(dep);
  return dep.url;
}

// `@rivetjs/kit/transition` (`.tsx`: the node loader would build it for the DOM): compiled for the server like a cdk
// module (cdk Modal renders its `TransitionScopeProvider` on the server).
const kit = new URL("../../kit/transition.tsx", import.meta.url);
let kitUrl: Promise<string> | undefined;
const kitModule = (): Promise<string> =>
  (kitUrl ??= (async () => {
    const result = compiler.compile(await readFile(kit, "utf8"), {
      target: "server",
      filename: "transition.tsx",
      resume: { module: "@rivetjs/kit/transition.tsx" },
    }) as unknown as { code: string; diagnostics: { message: string }[]; symbols: { id: string; component: string }[] };
    if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
    for (const s of result.symbols ?? []) symbols[s.id] = `/c/${s.component}.js`;
    let code = result.code;
    for (const specifier of runtime) code = code.replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)));
    return emit("kit-transition", code);
  })());

async function build(self: Built, name: string, source?: string): Promise<void> {
  const text = source ?? (await readFile(new URL(name, cdk), "utf8"));
  // `sourcePackages`: `@rivetjs/cdk/*` components get symbol callback / slot props, as in an app build (`rivet()`).
  const result = compiler.compile(text, {
    target: "server",
    filename: name,
    resume: { module: source ? `src/${name}` : `@rivetjs/cdk/${name}` },
    sourcePackages: ["@rivetjs/cdk"],
  }) as unknown as { code: string; diagnostics: { message: string }[]; symbols: { id: string; component: string }[] };
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  for (const s of result.symbols ?? []) symbols[s.id] = `/c/${s.component}.js`;
  let code = result.code;
  for (const specifier of runtime) code = code.replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)));
  // `#dev` (package `imports`): resolved here, under this run's conditions (dev-off, or dev-on in `cdk-dev`) — the temp dir has no package scope.
  code = code.replaceAll('"#dev"', JSON.stringify(import.meta.resolve("#dev")));
  // `#server` (package `imports`, server condition): the server build of the slot probe module, one instance for the graph.
  if (code.includes('"#server"')) code = code.replaceAll('"#server"', JSON.stringify(dependency(self, "collections/server-on.tsx")));
  if (code.includes('"@rivetjs/kit/transition"')) code = code.replaceAll('"@rivetjs/kit/transition"', JSON.stringify(await kitModule()));
  // cdk imports: relative ("./x.ts[x]", "../x") or by package subpath ("@rivetjs/cdk/x", resolved
  // through package.json `exports`); a directory resolves to its index, like the `./*` → `./*/index.tsx` export.
  const dir = source ? "" : name.slice(0, name.lastIndexOf("/") + 1);
  const imports = [...code.matchAll(/from\s+"((?:\.\.?\/|@rivetjs\/cdk\/)[^"]+)"/g)].map((m) => m[1]!);
  for (const specifier of new Set(imports)) {
    const base = specifier.startsWith("@rivetjs/cdk/")
      ? (resolveCdkSubpath(specifier.slice("@rivetjs/cdk/".length)) ?? specifier.slice("@rivetjs/cdk/".length))
      : new URL(specifier, new URL(dir, "file:///")).pathname.slice(1);
    const file = await resolveFile(base);
    const target = file.endsWith(".tsx") ? dependency(self, file) : pathToFileURL(new URL(file, cdk).pathname).href;
    code = code.replaceAll(`"${specifier}"`, JSON.stringify(target));
  }
  writeFileSync(self.file, code);
}

const exists = (file: string) =>
  readFile(new URL(file, cdk)).then(
    () => true,
    () => false,
  );

async function resolveFile(base: string): Promise<string> {
  if (/\.tsx?$/.test(base)) return base;
  for (const file of [base + ".tsx", base + ".ts", base + "/index.tsx", base + "/index.ts"]) if (await exists(file)) return file;
  throw new Error(`cdk test server: cannot resolve ${base}`);
}

/** Import a compiled module. */
export async function importModule<T>(name: string, source?: string): Promise<T> {
  return (await import(await serverModule(name, source))) as T;
}

/** Render `view` to resumable HTML. */
export function renderHtml(view: () => unknown): Promise<string> {
  const manifest: ResumeManifest = { hash: "cdk", runtime: "/rt.js", symbols: { ...symbols } };
  return resumableToString(view as Parameters<typeof resumableToString>[0], { manifest }) as Promise<string>;
}

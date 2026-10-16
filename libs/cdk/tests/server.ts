// Server-render cdk components in node tests: compile `.tsx` modules (and their `.tsx` imports) for
// the server in resume mode, point `.ts` imports at their files, render with `resumableToString`.
// Compiled modules are written to a per-process temp dir and imported by file URL. Never inline a dependency as a
// data URL inside its importer: every level re-embeds its whole subtree (base64), so a deep graph (date-picker)
// grew past 12 MB per URL and the module runner's copies of it past 4 GB.
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
const cache = new Map<string, Promise<string>>();
let out: string | undefined;
let seq = 0;

/** Write compiled module `code` to the temp dir; returns its file URL. */
function emit(name: string, code: string): string {
  if (!out) {
    const dir = (out = mkdtempSync(join(tmpdir(), "rivet-cdk-server-")));
    process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
  }
  const file = join(out, `${seq++}-${name.replace(/[^\w.-]+/g, "_")}.mjs`);
  writeFileSync(file, code);
  return pathToFileURL(file).href;
}

/** File URL of the server build of cdk module `name` (e.g. "modal.tsx"), or of `source` when given. */
export function serverModule(name: string, source?: string): Promise<string> {
  const key = source ? `${name}\0${source}` : name;
  let url = cache.get(key);
  if (!url) cache.set(key, (url = build(name, source)));
  return url;
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
    for (const s of result.symbols) symbols[s.id] = `/c/${s.component}.js`;
    let code = result.code;
    for (const specifier of runtime) code = code.replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)));
    return emit("kit-transition", code);
  })());

async function build(name: string, source?: string): Promise<string> {
  const text = source ?? (await readFile(new URL(name, cdk), "utf8"));
  // `sourcePackages`: `@rivetjs/cdk/*` components get symbol callback / slot props, as in an app build (`rivet()`).
  const result = compiler.compile(text, {
    target: "server",
    filename: name,
    resume: { module: source ? `src/${name}` : `@rivetjs/cdk/${name}` },
    sourcePackages: ["@rivetjs/cdk"],
  }) as unknown as { code: string; diagnostics: { message: string }[]; symbols: { id: string; component: string }[] };
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  for (const s of result.symbols) symbols[s.id] = `/c/${s.component}.js`;
  let code = result.code;
  for (const specifier of runtime) code = code.replaceAll(`"${specifier}"`, JSON.stringify(import.meta.resolve(specifier)));
  // `#dev` (package `imports`): resolved here, under this run's conditions (dev-off, or dev-on in `cdk-dev`) — the temp dir has no package scope.
  code = code.replaceAll('"#dev"', JSON.stringify(import.meta.resolve("#dev")));
  // `#server` (package `imports`, server condition): the server build of the slot probe module, one instance for the graph.
  if (code.includes('"#server"')) code = code.replaceAll('"#server"', JSON.stringify(await serverModule("collections/server-on.tsx")));
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
    const target = file.endsWith(".tsx") ? await serverModule(file) : pathToFileURL(new URL(file, cdk).pathname).href;
    code = code.replaceAll(`"${specifier}"`, JSON.stringify(target));
  }
  return emit(name, code);
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

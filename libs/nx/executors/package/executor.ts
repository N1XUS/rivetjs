// `@rivetjs/nx:package`: publishable Rivet library. `tsc -p tsconfig.lib.json` emits `.js` / `.jsx` (JSX preserved:
// the consuming app's Rivet compiler compiles it, like every `@rivetjs/*` package) and `.d.ts`; the manifest's
// source `exports` (`./src/x.ts`) are mapped to the emitted files and workspace-only fields dropped.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ExecutorContext } from "@nx/devkit";
import { projectRoot, resolverFrom, runSteps, type BinResolver, type Step } from "../run.ts";
import type { PackageExecutorSchema } from "./schema.js";

export type { PackageExecutorSchema } from "./schema.js";

type Exports = string | null | { [condition: string]: Exports };

export interface NormalizedPackageOptions {
  root: string;
  out: string;
  tsConfig: string;
  sourceRoot: string;
  assets: string[];
}

export function normalizePackageOptions(options: PackageExecutorSchema, workspaceRoot: string, root: string): NormalizedPackageOptions {
  return {
    root,
    out: resolve(workspaceRoot, options.outputPath ?? join("dist", relative(workspaceRoot, root))),
    tsConfig: options.tsConfig ?? "tsconfig.lib.json",
    sourceRoot: (options.sourceRoot ?? "src").replace(/^\.\//, "").replace(/\/$/, ""),
    assets: options.assets ?? [],
  };
}

export function emitStep(options: NormalizedPackageOptions, bin: BinResolver): Step {
  return { label: `tsc -p ${options.tsConfig}`, args: [bin("typescript", "tsc"), "-p", options.tsConfig, "--outDir", options.out], cwd: options.root };
}

/** `./src/button/index.ts` → `./button/index.js` (types: `.d.ts`); `.tsx` → `.jsx`. */
export function mapPath(path: string, sourceRoot: string, types: boolean): string {
  const prefix = `./${sourceRoot}/`;
  const inside = path.startsWith(prefix) ? "./" + path.slice(prefix.length) : path;
  if (/\.d\.[cm]?ts$/.test(inside) || !/\.[cm]?tsx?$/.test(inside)) return inside;
  if (types) return inside.replace(/\.([cm]?)tsx?$/, ".d.$1ts");
  return inside.replace(/\.([cm]?)ts$/, ".$1js").replace(/\.tsx$/, ".jsx");
}

function mapExports(value: Exports, sourceRoot: string, condition = "default"): Exports {
  if (typeof value === "string") return mapPath(value, sourceRoot, condition === "types");
  if (!value) return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, mapExports(inner, sourceRoot, key.startsWith(".") ? "default" : key)]));
}

/** The published manifest of a library manifest. */
export function distManifest(pkg: Record<string, unknown>, sourceRoot: string): Record<string, unknown> {
  const { private: _private, scripts: _scripts, devDependencies: _dev, nx: _nx, ...rest } = pkg;
  const out: Record<string, unknown> = { ...rest };
  if (pkg["exports"]) out["exports"] = mapExports(pkg["exports"] as Exports, sourceRoot);
  for (const field of ["main", "module"] as const) if (typeof pkg[field] === "string") out[field] = mapPath(pkg[field] as string, sourceRoot, false);
  if (typeof pkg["types"] === "string") out["types"] = mapPath(pkg["types"] as string, sourceRoot, true);
  return out;
}

export default async function packageExecutor(options: PackageExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const root = projectRoot(context);
  const normalized = normalizePackageOptions(options, context.root, root);
  rmSync(normalized.out, { recursive: true, force: true });
  mkdirSync(normalized.out, { recursive: true });
  const emitted = await runSteps([emitStep(normalized, resolverFrom(root))]);
  if (!emitted.success) return emitted;
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, unknown>;
  writeFileSync(join(normalized.out, "package.json"), JSON.stringify(distManifest(pkg, normalized.sourceRoot), null, 2) + "\n");
  for (const asset of ["README.md", "LICENSE", ...normalized.assets]) {
    if (existsSync(join(root, asset))) cpSync(join(root, asset), join(normalized.out, asset), { recursive: true });
  }
  console.log(`Packaged ${String(pkg["name"])} → ${relative(context.root, normalized.out)}`);
  return { success: true };
}

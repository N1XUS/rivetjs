// Publishable package of one `libs/<pkg>`: `dist/libs/<pkg>` = emitted `.js` / `.jsx` + `.d.ts`, the assets
// the code loads at runtime, LICENSE (+ NOTICE), and a package.json whose `exports` / `imports` / `bin`
// point at the emitted files. The workspace keeps resolving `libs/<pkg>` sources (its package.json is
// untouched); only the generated manifest is meant for `npm pack` / `npm publish`.
//
//   node scripts/package/build.ts libs/<pkg> [--out <dir>] [--no-typecheck]
//
// `.ts` → `.js`; `.tsx` → `.jsx` (JSX preserved: the consumer's Rivet Vite plugin compiles it per target,
// server / DOM / resume, exactly as it compiles the workspace sources). Relative `.ts` specifiers are
// rewritten (TypeScript `rewriteRelativeImportExtensions` for JS; the same rewrite for `.d.ts` and for
// `new URL("./x.ts", import.meta.url)` module paths, which the code hands to Vite or Node at runtime).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "../..");

/** A manifest path (`./x.ts`) under a condition, as the emitted package names it. */
export function mapTarget(condition: string, target: string): string {
  if (/\.d\.[cm]?ts$/.test(target)) return target;
  if (condition === "types") return target.replace(/\.(ts|tsx)$/, ".d.ts");
  return target.replace(/\.ts$/, ".js").replace(/\.tsx$/, ".jsx");
}

type Conditions = string | null | { [condition: string]: Conditions };

/** Maps every path of an `exports` / `imports` value (nested conditions included). */
export function mapConditions(value: Conditions, condition = "default"): Conditions {
  if (typeof value === "string") return mapTarget(condition, value);
  if (value === null) return null;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, mapConditions(inner, key === "types" ? "types" : key)]));
}

/** Every path string of an `exports` / `imports` value. */
export function targetsOf(value: Conditions): string[] {
  if (typeof value === "string") return [value];
  if (value === null) return [];
  return Object.values(value).flatMap(targetsOf);
}

/** Relative module specifiers ending in `.ts` / `.tsx` (outside `.d.ts`) → emitted extensions. */
export function rewriteSpecifiers(code: string, declaration: boolean): string {
  const ext = (spec: string) => (/\.d\.[cm]?ts$/.test(spec) ? spec : spec.replace(/\.ts$/, ".js").replace(/\.tsx$/, ".jsx"));
  const spec = String.raw`(["'])(\.\.?\/[^"'\n]*?\.tsx?)\2`;
  // Declarations: import / export / import() type specifiers. JS: module paths in `new URL(…, import.meta.url)`.
  const pattern = declaration
    ? new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)` + spec, "g")
    : new RegExp(String.raw`(\bnew\s+URL\s*\(\s*)` + spec + String.raw`(?=\s*,\s*import\.meta\.url)`, "g");
  return code.replace(pattern, (_, head: string, quote: string, spec: string) => head + quote + ext(spec) + quote);
}

/** Paths a module resolves with `new URL("./…", import.meta.url)` (not in `//` comments or `*`-prefixed block comment lines). */
export function urlTargets(code: string): string[] {
  return [...code.matchAll(/\bnew\s+URL\s*\(\s*(["'])(\.\.?\/[^"'\n]*)\1\s*,\s*import\.meta\.url/g)]
    .filter((match) => {
      const before = code.slice(code.lastIndexOf("\n", match.index) + 1, match.index);
      return !before.includes("//") && !/^\s*(\/\*|\*)/.test(before);
    })
    .map((match) => match[2]!);
}

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  exports?: Record<string, Conditions>;
  imports?: Record<string, Conditions>;
  bin?: string | Record<string, string>;
  main?: string;
  types?: string;
  files?: string[];
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  publishConfig?: Record<string, unknown>;
  [field: string]: unknown;
}

/** Files under `dir` (relative, posix) matching an `exports` subpath pattern target (`./a/*.ts`). */
function expand(dir: string, target: string): string[] {
  const [prefix = "", suffix = ""] = target.slice(2).split("*", 2);
  const base = join(dir, dirname(prefix + "x"));
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "tests") walk(path);
        continue;
      }
      const rel = relative(dir, path).split(sep).join("/");
      if (rel.startsWith(prefix) && rel.endsWith(suffix) && rel.length >= prefix.length + suffix.length) out.push(rel);
    }
  };
  walk(base);
  return out;
}

/** The emitted manifest: paths mapped, workspace-only fields dropped, `files` = the package contents. */
export function distManifest(pkg: Manifest, files: string[], repository?: unknown, directory?: string): Manifest {
  const { private: _private, scripts: _scripts, devDependencies: _dev, publishConfig, files: _files, ...rest } = pkg;
  const out: Manifest = { ...rest };
  // `repository`: the workspace root's, pointed at the package directory (monorepo convention).
  if (!out["repository"] && repository) {
    const repo = typeof repository === "string" ? { type: "git", url: repository } : (repository as Record<string, unknown>);
    out["repository"] = directory ? { ...repo, directory } : repo;
  }
  // `homepage` / `bugs` for the npm page: derived from a GitHub `repository` when the package names none.
  const web = githubWeb(out["repository"]);
  if (web && !out["homepage"]) out["homepage"] = `${web}/tree/main${directory ? "/" + directory : ""}#readme`;
  if (web && !out["bugs"]) out["bugs"] = { url: `${web}/issues` };
  // `publishConfig` minus the workspace-only keys (`directory`: where this package is built, `prebuilt`, `bundle`).
  const { directory: _directory, prebuilt: _prebuilt, bundle: _bundle, ...publish } = publishConfig ?? {};
  if (Object.keys(publish).length) out.publishConfig = publish;
  if (pkg.exports) out.exports = Object.fromEntries(Object.entries(pkg.exports).map(([key, value]) => [key, mapConditions(value)]));
  if (pkg.imports) out.imports = Object.fromEntries(Object.entries(pkg.imports).map(([key, value]) => [key, mapConditions(value)]));
  if (typeof pkg.bin === "string") out.bin = mapTarget("default", pkg.bin);
  else if (pkg.bin) out.bin = Object.fromEntries(Object.entries(pkg.bin).map(([key, value]) => [key, mapTarget("default", value)]));
  if (pkg.main) out.main = mapTarget("default", pkg.main);
  if (pkg.types) out.types = mapTarget("types", pkg.types);
  out.files = [...new Set(files.map((file) => file.split("/")[0]!))].filter((file) => file !== "package.json").sort();
  return out;
}

/** `https://github.com/<owner>/<repo>` of a GitHub `repository` field (string or `{ url }`), else undefined. */
export function githubWeb(repository: unknown): string | undefined {
  const url = typeof repository === "string" ? repository : (repository as { url?: unknown } | undefined)?.url;
  const match = typeof url === "string" ? /github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?(?:[/#]|$)/.exec(url) : null;
  return match ? `https://github.com/${match[1]}/${match[2]}` : undefined;
}

export interface BuildResult {
  out: string;
  files: string[];
  /** Problems that make the package unusable (missing emitted paths, `.ts` literals left in JS). */
  warnings: string[];
  /** Publish metadata gaps (no `repository`). */
  notices: string[];
}

/** Builds `libs/<pkg>` (absolute or root-relative) into `out` (default `dist/libs/<pkg>`). */
export function buildPackage(libDir: string, outDir?: string, { typecheck = true }: { typecheck?: boolean } = {}): BuildResult {
  const dir = resolve(ROOT, libDir);
  const out = resolve(ROOT, outDir ?? join("dist", relative(ROOT, dir)));
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
  const prebuilt = pkg.publishConfig?.["prebuilt"];
  const warnings: string[] = [];

  // Entry targets: every exports / imports / bin / main path (subpath patterns expanded).
  const targets = new Set<string>();
  const add = (target: string) => {
    if (target.includes("*")) for (const file of expand(dir, target)) targets.add(file);
    else targets.add(target.replace(/^\.\//, ""));
  };
  for (const value of Object.values(pkg.exports ?? {})) targetsOf(value).forEach(add);
  for (const value of Object.values(pkg.imports ?? {})) targetsOf(value).forEach(add);
  for (const bin of typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin ?? {})) add(bin);
  if (pkg.main) add(pkg.main);
  if (pkg.types) add(pkg.types);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const assets = new Set<string>();
  const isModule = (file: string) => /\.tsx?$/.test(file) && !/\.d\.[cm]?ts$/.test(file);
  for (const file of targets) if (!isModule(file)) assets.add(file);

  if (!prebuilt) {
    const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, "tsconfig.base.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })!;
    const options: ts.CompilerOptions = {
      ...config.options,
      noEmit: false,
      declaration: true,
      outDir: out,
      rootDir: dir,
      rewriteRelativeImportExtensions: true,
      sourceMap: false,
      declarationMap: false,
      removeComments: false,
      plugins: [],
    };
    const roots = new Set([...targets].filter(isModule).map((file) => join(dir, file)));
    let program: ts.Program | undefined;
    // Modules named by `new URL("./x.ts", import.meta.url)` join the roots (fixpoint); other URL targets are assets.
    for (;;) {
      program = ts.createProgram({ rootNames: [...roots], options, ...(program ? { oldProgram: program } : {}) });
      const size = roots.size;
      for (const source of program.getSourceFiles()) {
        if (source.isDeclarationFile || program.isSourceFileFromExternalLibrary(source) || !source.fileName.startsWith(dir + "/")) continue;
        for (const url of urlTargets(source.text)) {
          const target = resolve(dirname(source.fileName), url);
          if (target === dir) continue; // the package directory itself
          if (!target.startsWith(dir + sep)) {
            warnings.push(`${relative(ROOT, source.fileName)}: new URL("${url}") leaves the package`);
            continue;
          }
          if (isModule(target)) roots.add(target);
          else assets.add(relative(dir, target).split(sep).join("/"));
        }
      }
      if (roots.size === size) break;
    }
    const emitted = program.emit(undefined, (file, text) => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, /\.d\.[cm]?ts$/.test(file) ? rewriteSpecifiers(text, true) : rewriteSpecifiers(text, false));
    });
    // Declaration emit problems always fail; semantic errors too unless `--no-typecheck` (the typecheck gate owns them).
    // Own files only: dependencies are other packages' builds (their sources resolve through node_modules).
    const own = program.getSourceFiles().filter((source) => source.fileName.startsWith(dir + sep) && !program.isSourceFileFromExternalLibrary(source));
    const diagnostics = [
      ...program.getOptionsDiagnostics(),
      ...own.flatMap((source) => [...program.getSyntacticDiagnostics(source), ...(typecheck ? program.getSemanticDiagnostics(source) : [])]),
      ...emitted.diagnostics,
    ];
    if (diagnostics.length) {
      const host = { getCanonicalFileName: (file: string) => file, getCurrentDirectory: () => ROOT, getNewLine: () => "\n" };
      throw new Error(`${pkg.name}: ${diagnostics.length} TypeScript diagnostics\n` + ts.formatDiagnostics(diagnostics.slice(0, 20), host));
    }
    for (const source of program.getSourceFiles()) {
      if (!source.fileName.startsWith(dir + sep) || program.isSourceFileFromExternalLibrary(source)) continue;
      // Declarations the program reads from the package (`client.d.ts`, `virtual.d.ts`) ship as written.
      if (source.isDeclarationFile) assets.add(relative(dir, source.fileName).split(sep).join("/"));
    }
  } else {
    // Packages with their own bundler (`publishConfig.prebuilt`: the build output directory) ship it as is.
    assets.add(String(prebuilt));
  }

  for (const asset of assets) {
    const from = join(dir, asset);
    if (!existsSync(from)) {
      warnings.push(`${pkg.name}: missing ${asset}${prebuilt ? " (run the package's build target first)" : ""}`);
      continue;
    }
    const to = join(out, asset);
    mkdirSync(dirname(to), { recursive: true });
    if (/\.d\.[cm]?ts$/.test(asset)) writeFileSync(to, rewriteSpecifiers(readFileSync(from, "utf8"), true));
    else cpSync(from, to, { recursive: true });
  }
  // `publishConfig.bundle: "./script.ts"`: a package-time step that adds files from outside the lib (create-rivet:
  // the repository's templates/), run as `node <script> <out>`.
  const bundle = pkg.publishConfig?.["bundle"];
  if (typeof bundle === "string") {
    const run = spawnSync(process.execPath, [join(dir, bundle), out], { cwd: ROOT, encoding: "utf8" });
    if (run.status !== 0) warnings.push(`${pkg.name}: bundle step ${bundle} failed: ${(run.stderr || run.stdout).trim()}`);
  }
  cpSync(join(ROOT, "LICENSE"), join(out, "LICENSE"));
  for (const extra of ["NOTICE", "README.md"]) if (existsSync(join(dir, extra))) cpSync(join(dir, extra), join(out, extra));
  const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { repository?: unknown };
  const directory = relative(ROOT, dir).split(sep).join("/");
  // No README of its own: a short one for the npm page (description, install, source + docs links).
  if (!existsSync(join(dir, "README.md"))) {
    const web = githubWeb(root.repository);
    const description = typeof pkg["description"] === "string" ? pkg["description"] : "";
    const links = web ? `\n\nSource: ${web}/tree/main/${directory} · Docs: ${web}/tree/main/apps/docs/content · Issues: ${web}/issues\n` : "\n";
    writeFileSync(
      join(out, "README.md"),
      `# ${pkg.name}\n\n${description}${description ? "\n\n" : ""}Part of Rivet, a compiled, resumable JSX framework. Start a project with \`npm create rivet@latest\`.\n\n\`\`\`sh\nnpm install ${pkg.name}\n\`\`\`${links}`,
    );
  }

  const files: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(out, path).split(sep).join("/"));
    }
  };
  walk(out);
  // Leftover `.ts` module paths passed to calls in emitted JS (`resolve("./x.ts")`: the rewrite above misses them).
  for (const file of files) {
    if (!/\.jsx?$/.test(file)) continue;
    const text = readFileSync(join(out, file), "utf8");
    for (const match of text.matchAll(/[(,]\s*["'](\.\.?\/[^"'\n]*\.tsx?)["']/g)) {
      // Only paths of this package's own modules (generated app files like "./app.tsx" are the consumer's).
      if (existsSync(resolve(dir, dirname(file), match[1]!))) warnings.push(`${pkg.name}/${file}: literal "${match[1]}"`);
    }
  }
  // Every manifest path must exist in the package.
  const manifest = distManifest(pkg, files, root.repository, directory);
  // Not fatal (local packs work without them); `npm publish` provenance and the npm page need them.
  const notices = manifest["repository"] ? [] : [`${pkg.name}: no "repository" (set it in the workspace root package.json)`];
  if (!manifest["description"]) notices.push(`${pkg.name}: no "description" (libs/<lib>/package.json; npm search + the generated README use it)`);
  const check = (target: string) => {
    if (target.includes("*")) return;
    if (!existsSync(join(out, target))) warnings.push(`${pkg.name}: manifest path ${target} not emitted`);
  };
  for (const value of [...Object.values(manifest.exports ?? {}), ...Object.values(manifest.imports ?? {})]) targetsOf(value).forEach(check);
  for (const bin of typeof manifest.bin === "string" ? [manifest.bin] : Object.values(manifest.bin ?? {})) check(bin);
  writeFileSync(join(out, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { out, files: [...files, "package.json"].sort(), warnings, notices };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const outDir = outAt >= 0 ? args.splice(outAt, 2)[1] : undefined;
  const noCheck = args.indexOf("--no-typecheck");
  if (noCheck >= 0) args.splice(noCheck, 1);
  if (args.length !== 1) {
    console.error("usage: node scripts/package/build.ts libs/<pkg> [--out <dir>] [--no-typecheck]");
    process.exit(2);
  }
  const started = performance.now();
  const result = buildPackage(args[0]!, outDir, { typecheck: noCheck < 0 });
  const bytes = result.files.reduce((sum, file) => sum + statSync(join(result.out, file)).size, 0);
  console.log(
    `${basename(args[0]!)}: ${result.files.length} files, ${(bytes / 1024).toFixed(1)} KB → ${relative(ROOT, result.out)} (${Math.round(performance.now() - started)} ms)`,
  );
  for (const notice of result.notices) console.warn("notice: " + notice);
  for (const warning of result.warnings) console.warn("warning: " + warning);
  if (result.warnings.length) process.exitCode = 1;
}

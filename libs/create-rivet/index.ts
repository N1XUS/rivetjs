// create-rivet: copies a Rivet starter template into a new folder, rewrites its `@rivetjs/*` dependencies to
// the published version, writes the package name, then optionally installs dependencies and runs `git init`.
// `cli.ts` parses the command line and asks the questions; everything here is plain functions (tests call them).
//
// Templates: the published package ships them in `templates/` (copied from the repository's `templates/` at
// package time by `bundle.ts`); inside the repository they are read from `templates/` directly.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Starter templates offered by the CLI (`--template <id>`); `dir` is the folder under `templates/`. */
export const TEMPLATES = [
  { id: "static", dir: "starter-static", label: "Static site", hint: "pages prerendered to HTML, Tailwind, two routes, a counter" },
  { id: "server", dir: "starter-server", label: "Node server", hint: "loader + form action per request, Tailwind, Dockerfile" },
  { id: "ui", dir: "starter-ui", label: "UI components", hint: "@rivetjs/ui components + Tailwind v4, static" },
  { id: "minimal", dir: "starter-minimal", label: "Minimal", hint: "one page, one signal, no Tailwind" },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** This package's own manifest version: every `@rivetjs/*` package is released with the same version. */
export function ownVersion(): string {
  return (JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { version: string }).version;
}

/** The dependency range written for `@rivetjs/*`: exact for a prerelease (`0.1.0-alpha.1`), `^x.y.z` otherwise. */
export function versionRange(version: string): string {
  return version.includes("-") ? version : "^" + version;
}

/** Where the templates are: bundled next to the code (published package) or the repository's `templates/`. */
export function templatesRoot(): string {
  const bundled = join(HERE, "templates");
  return existsSync(bundled) ? bundled : resolve(HERE, "../../templates");
}

/** `templates/_<name>` (an overlay's files), bundled or in the repository. */
export function overlayDir(name: string): string {
  return join(templatesRoot(), "_" + name);
}

export function findTemplate(name: string): (typeof TEMPLATES)[number] | undefined {
  return TEMPLATES.find((template) => template.id === name || template.dir === name);
}

/** The package manager that runs us (`npm create` / `pnpm create` / `yarn create` / `bun create` set the user agent). */
export function detectPackageManager(userAgent = process.env["npm_config_user_agent"] ?? ""): PackageManager {
  const name = userAgent.split("/")[0];
  return (PACKAGE_MANAGERS as readonly string[]).includes(name ?? "") ? (name as PackageManager) : "npm";
}

/** Commands shown after creation for a package manager. */
export function commands(pm: PackageManager): { install: string; run: (script: string) => string } {
  return {
    install: pm === "yarn" ? "yarn" : `${pm} install`,
    run: (script) => (pm === "npm" || pm === "bun" ? `${pm} run ${script}` : `${pm} ${script}`),
  };
}

/** An npm package name from a folder name (`My App` → `my-app`). */
export function toPackageName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^[._]+/, "")
      .replace(/[^a-z0-9~._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "rivet-app"
  );
}

/** `undefined` when `name` is a valid npm package name, else why not. */
export function validatePackageName(name: string): string | undefined {
  if (!name) return "Name is empty";
  if (name.length > 214) return "Name is longer than 214 characters";
  if (!/^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/.test(name)) return "Use lowercase letters, digits, '-', '.', '_' (npm package name rules)";
  return undefined;
}

/** True when `dir` is missing or holds nothing but `.git` / `.DS_Store`. */
export function isEmptyDir(dir: string): boolean {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).every((entry) => entry === ".git" || entry === ".DS_Store");
}

/** Template paths never copied: build output, installs, generated route types, StackBlitz config. */
export const SKIP = /(^|[/\\])(node_modules|dist|\.rivet|\.stackblitzrc)([/\\]|$)/;
/** npm never packs `.gitignore` files: the bundled templates carry them as `_gitignore`. */
export const RENAMES: Readonly<Record<string, string>> = { _gitignore: ".gitignore" };

/** One file of a template (or overlay) folder: `path` relative to the folder (posix, {@link RENAMES} applied). */
export interface TemplateFile {
  path: string;
  /** Absolute source path. */
  source: string;
}

/**
 * The files of a template (or overlay) folder, sorted: skips {@link SKIP}, applies {@link RENAMES}. Shared by
 * {@link copyTemplateDir} and `@rivetjs/nx` (which writes them into an Nx `Tree` instead of the file system).
 */
export function templateFiles(from: string): TemplateFile[] {
  const files: TemplateFile[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      const rel = relative(from, path);
      if (SKIP.test(rel)) continue;
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      files.push({
        path: join(dirname(rel), RENAMES[entry.name] ?? entry.name)
          .split(sep)
          .join("/"),
        source: path,
      });
    }
  };
  walk(from);
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Copies a template (or an overlay) folder onto `to`: skips {@link SKIP}, applies {@link RENAMES}. */
export function copyTemplateDir(from: string, to: string): string[] {
  const copied: string[] = [];
  for (const file of templateFiles(from)) {
    const target = join(to, file.path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file.source, target);
    copied.push(relative(to, target).split(sep).join("/"));
  }
  return copied.sort();
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [field: string]: unknown;
}

/**
 * The template's `package.json` for the new project: `name`, `version` 0.1.0, every `@rivetjs/*` (and `create-rivet`)
 * dependency → `range` (templates name `experimental` / `workspace:` / `file:` / `link:` specs that only resolve in the repo).
 */
export function rewriteManifest(pkg: PackageJson, name: string, range: string): PackageJson {
  const out: PackageJson = { ...pkg, name, version: "0.1.0" };
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    out[field] = Object.fromEntries(Object.entries(deps).map(([dep, spec]) => [dep, dep.startsWith("@rivetjs/") || dep === "create-rivet" ? range : spec]));
  }
  return out;
}

/**
 * Extension point for options layered over a template (e.g. a deploy target, `--deploy`): files copied over the
 * template (`dir`, same skip / rename rules; keep them in `templates/_<name>/`, which `bundle.ts` ships and
 * {@link overlayDir} finds), then `manifest` edits the new `package.json` (scripts, dependencies), then `edit`
 * changes other files in place (`deploy.ts`: vite.config.ts, .gitignore, netlify.toml).
 */
export interface Overlay {
  name: string;
  dir?: string;
  manifest?: (pkg: PackageJson) => PackageJson;
  /** Edits files of the new project (after `dir`); returns the paths it wrote (relative) and removed. */
  edit?: (dir: string) => { written?: string[]; removed?: string[] };
}

export interface CreateOptions {
  /** Target folder (created). */
  dir: string;
  template: TemplateId;
  /** `package.json` name (default: from the folder name). */
  name?: string;
  /** `@rivetjs/*` dependency spec (default: {@link versionRange} of this package's version). */
  rivetVersion?: string;
  overlays?: Overlay[];
  /** Templates folder (default {@link templatesRoot}). */
  templates?: string;
}

/** Writes the project. Throws when the template is unknown. Does not install or run git. */
export function createProject(options: CreateOptions): { dir: string; name: string; files: string[] } {
  const template = findTemplate(options.template);
  if (!template) throw new Error(`Unknown template "${options.template}" (${TEMPLATES.map((t) => t.id).join(", ")})`);
  const source = join(options.templates ?? templatesRoot(), template.dir);
  if (!existsSync(join(source, "package.json"))) throw new Error(`Template files missing: ${source}`);
  const dir = resolve(options.dir);
  const name = options.name ?? toPackageName(basename(dir));
  mkdirSync(dir, { recursive: true });
  const files = new Set(copyTemplateDir(source, dir));
  let pkg = rewriteManifest(
    JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson,
    name,
    options.rivetVersion ?? versionRange(ownVersion()),
  );
  for (const overlay of options.overlays ?? []) {
    if (overlay.dir) for (const file of copyTemplateDir(overlay.dir, dir)) files.add(file);
    if (overlay.manifest) pkg = overlay.manifest(pkg);
    const edited = overlay.edit?.(dir);
    for (const file of edited?.written ?? []) files.add(file);
    for (const file of edited?.removed ?? []) files.delete(file);
  }
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  return { dir, name, files: [...files].sort() };
}

/** `<pm> install` in `dir` (inherits the terminal). Returns whether it succeeded. */
export function installDependencies(dir: string, pm: PackageManager, { stdio = "inherit" as "inherit" | "pipe" } = {}): boolean {
  const run = spawnSync(pm, pm === "yarn" ? [] : ["install"], { cwd: dir, stdio, shell: process.platform === "win32" });
  return run.status === 0;
}

/** `git init` + first commit, unless git is missing or `dir` is already inside a work tree. */
export function initGit(dir: string): "created" | "committed" | "inside-repo" | "no-git" | "failed" {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf8" });
  if (git("--version").status !== 0) return "no-git";
  if (git("rev-parse", "--is-inside-work-tree").stdout?.trim() === "true") return "inside-repo";
  if (git("init", "-q").status !== 0) return "failed";
  if (git("add", "-A").status !== 0) return "failed";
  // No identity configured: the repository stays initialised with the files staged.
  return git("commit", "-q", "-m", "Initial commit from create-rivet").status === 0 ? "committed" : "created";
}

/** `dir` exists and is a file (not a folder). */
export function isFile(path: string): boolean {
  return existsSync(path) && !statSync(path).isDirectory();
}

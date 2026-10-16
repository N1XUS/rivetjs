// Workspace-level helpers shared by the generators.
import { readJson, readNxJson, updateJson, type Tree } from "@nx/devkit";

/** Whether new projects get inferred targets (official plugins' rule: `NX_ADD_PLUGINS` and nx.json `useInferencePlugins`). */
export function shouldAddPlugin(tree: Tree, addPlugin: boolean | undefined): boolean {
  if (addPlugin !== undefined) return addPlugin;
  if (process.env["NX_ADD_PLUGINS"] === "false") return false;
  return readNxJson(tree)?.useInferencePlugins !== false;
}

/** Appends missing lines to a `.gitignore`-style file. */
export function ensureLines(tree: Tree, path: string, lines: string[]): void {
  const text = tree.exists(path) ? tree.read(path, "utf8")! : "";
  const have = new Set(text.split("\n").map((line) => line.trim()));
  const missing = lines.filter((line) => !have.has(line));
  if (!missing.length) return;
  tree.write(path, (text && !text.endsWith("\n") ? text + "\n" : text) + missing.join("\n") + "\n");
}

/** A workspaces glob (`apps/*`, `libs/**`) as a RegExp over project roots. */
function globRegExp(pattern: string): RegExp {
  const body = pattern
    .replace(/\/+$/, "")
    .split("/")
    .map((part) => (part === "**" ? ".*" : part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")))
    .join("/");
  return new RegExp(`^${body}$`);
}

/** The package manager workspaces globs (npm / yarn / bun `workspaces`, pnpm-workspace.yaml `packages`). */
export function workspaceGlobs(tree: Tree): string[] | undefined {
  if (tree.exists("pnpm-workspace.yaml")) {
    const text = tree.read("pnpm-workspace.yaml", "utf8")!;
    return [...text.matchAll(/^\s*-\s*["']?([^"'\n]+)["']?\s*$/gm)].map((match) => match[1]!.trim());
  }
  if (!tree.exists("package.json")) return undefined;
  const workspaces = readJson<{ workspaces?: string[] | { packages?: string[] } }>(tree, "package.json").workspaces;
  if (!workspaces) return undefined;
  return Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
}

/** Whether `root` is a package manager workspace (its package.json dependencies get installed by the root install). */
export function isWorkspacePackage(tree: Tree, root: string): boolean {
  const globs = workspaceGlobs(tree);
  return Boolean(globs?.some((glob) => !glob.startsWith("!") && globRegExp(glob).test(root)));
}

/** Adds `root` to npm / yarn / bun `workspaces` when the root package.json has a workspaces list that misses it. */
export function addToWorkspaces(tree: Tree, root: string): void {
  if (tree.exists("pnpm-workspace.yaml") || !tree.exists("package.json") || isWorkspacePackage(tree, root)) return;
  updateJson<{ workspaces?: string[] | { packages?: string[] } }>(tree, "package.json", (pkg) => {
    if (Array.isArray(pkg.workspaces)) pkg.workspaces.push(root);
    else if (pkg.workspaces) (pkg.workspaces.packages ??= []).push(root);
    return pkg;
  });
}

/** `../..` from a project root to the workspace root. */
export function offsetTo(root: string): string {
  const depth = root.split("/").filter((part) => part && part !== ".").length;
  return depth ? Array.from({ length: depth }, () => "..").join("/") : ".";
}

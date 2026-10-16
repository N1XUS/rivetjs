// Project facts from the file system (executors, the inference plugin) or an Nx `Tree` (generators).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tree } from "@nx/devkit";
import { detectProject, VITE_CONFIGS, VITEST_CONFIGS, type ProjectFacts } from "./detect.ts";

interface Reader {
  exists(path: string): boolean;
  read(path: string): string | undefined;
}

const disk: Reader = {
  exists: (path) => existsSync(path),
  read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined),
};

function treeReader(tree: Tree): Reader {
  return { exists: (path) => tree.exists(path), read: (path) => (tree.exists(path) ? (tree.read(path, "utf8") ?? undefined) : undefined) };
}

/** The first existing file of `names` in `dir`. */
function first(reader: Reader, dir: string, names: readonly string[]): string | undefined {
  return names.map((name) => join(dir, name)).find((path) => reader.exists(path));
}

function factsWith(reader: Reader, dir: string): ProjectFacts | undefined {
  const vite = first(reader, dir, VITE_CONFIGS);
  const vitest = first(reader, dir, VITEST_CONFIGS);
  const i18n = first(reader, dir, ["i18n.config.ts", "i18n.config.js", "i18n.config.mts", "i18n.config.mjs"]);
  return detectProject({
    ...(vite ? { vite: reader.read(vite)! } : {}),
    ...(vitest ? { vitest: reader.read(vitest)! } : {}),
    ...(i18n ? { i18n: reader.read(i18n)! } : {}),
    files: {
      tsconfig: reader.exists(join(dir, "tsconfig.json")),
      serveScript: reader.exists(join(dir, "serve.js")),
      prerenderScript: reader.exists(join(dir, "prerender.js")),
    },
  });
}

/** Facts of the project in `dir` (absolute) on disk. */
export function projectFacts(dir: string): ProjectFacts | undefined {
  return factsWith(disk, dir);
}

/** Facts of the project at `root` (workspace-relative) in a generator tree. */
export function treeFacts(tree: Tree, root: string): ProjectFacts | undefined {
  return factsWith(treeReader(tree), root);
}

/** The Vite config path of a project (workspace-relative in a tree), if any. */
export function viteConfigPath(tree: Tree, root: string): string | undefined {
  return first(treeReader(tree), root, VITE_CONFIGS);
}

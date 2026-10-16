// Test helpers: an empty Nx workspace tree that formats with prettier (the default tree carries an oxfmt config,
// and oxfmt is not installed here).
import type { Tree } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

export function emptyWorkspace(): Tree {
  const tree = createTreeWithEmptyWorkspace();
  tree.delete(".oxfmtrc.json");
  tree.write(".prettierrc", JSON.stringify({ printWidth: 120 }) + "\n");
  return tree;
}

/** Text of a tree file (throws when missing). */
export function read(tree: Tree, path: string): string {
  const text = tree.read(path, "utf8");
  if (text === null) throw new Error(`missing ${path}`);
  return text;
}

/** Files under `dir` (relative, sorted). */
export function filesUnder(tree: Tree, dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const child of tree.children(at)) {
      const path = at ? `${at}/${child}` : child;
      if (tree.isFile(path)) out.push(path.slice(dir.length + 1));
      else walk(path);
    }
  };
  walk(dir);
  return out.sort();
}

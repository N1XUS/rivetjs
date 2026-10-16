// `--deploy <target>` in an Nx workspace: create-rivet's own deploy overlay (`create-rivet/deploy`), so a Nx app and
// `npm create rivet -- --deploy <target>` get the same vite.config adapter, .gitignore lines, netlify.toml, README
// section, removed files and dependencies. Only the npm scripts the overlay adds become Nx targets instead
// (`deployScripts` → `utils/targets.ts`), and the README / netlify.toml commands name those targets.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Tree } from "@nx/devkit";
import type { PackageJson, TemplateId } from "create-rivet";
import { DEPLOY_TARGETS, deployOverlay, deployProblem, findDeployTarget, type DeployTarget } from "create-rivet/deploy";

export { DEPLOY_TARGETS, deployProblem, findDeployTarget, type DeployTarget };

/** The npm scripts create-rivet's overlay adds for `adapter` (`deploy`, `preview`, `start`); `{}` for other adapters. */
export function deployScripts(adapter: string | undefined): Record<string, string> {
  const target = adapter ? findDeployTarget(adapter) : undefined;
  if (!target) return {};
  const pkg = deployOverlay(target.id).manifest?.({}) ?? {};
  return (pkg["scripts"] as Record<string, string> | undefined) ?? {};
}

/** Folders the router's platform packaging writes outside `dist/` (`libs/router/adapters/pack.ts`): build outputs. */
export function deployOutputs(adapter: string | undefined): string[] {
  if (adapter === "vercel" || adapter === "vercel-edge") return ["{projectRoot}/.vercel/output"];
  if (adapter === "netlify") return ["{projectRoot}/.netlify/v1"];
  if (adapter === "cloudflare") return ["{projectRoot}/.wrangler/deploy"];
  return [];
}

/** Every file under `root` in the tree (workspace-relative paths). */
function treeFiles(tree: Tree, root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of tree.children(dir)) {
      const path = join(dir, name);
      if (tree.isFile(path)) out.push(path);
      else walk(path);
    }
  };
  walk(root);
  return out;
}

/** npm script → the Nx target that replaces it (bun / deno `start` = the `preview` target). */
const TARGET_OF: Record<string, string> = { build: "build", deploy: "deploy", preview: "preview", start: "preview" };

/**
 * Applies create-rivet's deploy overlay for `target` to the project at `root`: `edit` runs on a scratch copy of the
 * project (the overlay edits files on disk), then the files it wrote or removed are mirrored into the tree. `pkg`
 * gets the overlay's dependencies (scripts are dropped: Nx targets). Throws create-rivet's `deployProblem`.
 */
export function applyDeploy(tree: Tree, root: string, template: TemplateId, target: DeployTarget, project: string, pkg: PackageJson): PackageJson {
  const problem = deployProblem(target, template);
  if (problem) throw new Error(`application: ${problem}`);
  const overlay = deployOverlay(target, "npm");
  const next = overlay.manifest ? overlay.manifest(pkg) : pkg;
  delete next["scripts"];
  const scratch = mkdtempSync(join(tmpdir(), "rivet-nx-deploy-"));
  try {
    for (const file of treeFiles(tree, root)) {
      const at = join(scratch, file.slice(root.length + 1));
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, tree.read(file)!);
    }
    const result = overlay.edit?.(scratch);
    for (const file of result?.written ?? []) tree.write(join(root, file), readFileSync(join(scratch, file)));
    for (const file of result?.removed ?? []) tree.delete(join(root, file));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  // The overlay's commands run npm scripts; in Nx they are targets.
  const nx = (text: string) => text.replace(/\bnpm run (\w+)/g, (all, script: string) => (TARGET_OF[script] ? `nx ${TARGET_OF[script]} ${project}` : all));
  const netlify = join(root, "netlify.toml");
  if (tree.exists(netlify)) tree.write(netlify, tree.read(netlify, "utf8")!.replace(/command = "npm run build"/, `command = "npx nx build ${project}"`));
  const readme = join(root, "README.md");
  if (tree.exists(readme)) {
    const text = tree.read(readme, "utf8")!;
    const at = text.indexOf("\n## Deploy: ");
    if (at >= 0) tree.write(readme, text.slice(0, at) + nx(text.slice(at)));
  }
  return next;
}

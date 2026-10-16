// `nx g @rivetjs/nx:application apps/web --template=static|server|ui|minimal [--adapter=node|static] [--tailwind]`:
// a create-rivet starter in an Nx workspace. The starter files come from create-rivet (`utils/starter.ts`); this
// generator only layers Nx concerns over them: project.json, adapter / Tailwind switches, Vitest, dependencies.
import { fileURLToPath } from "node:url";
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  installPackagesTask,
  readJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from "@nx/devkit";
import { applyDeploy, deployProblem, deployScripts, findDeployTarget, type DeployTarget } from "../../utils/deploy.ts";
import { treeFacts } from "../../utils/facts.ts";
import { starterFile, writeStarter, type PackageJson } from "../../utils/starter.ts";
import { rivetTargets } from "../../utils/targets.ts";
import { HAPPY_DOM_VERSION, rivetRange, toolVersion, VITEST_VERSION } from "../../utils/versions.ts";
import { addImport, addPlugin, removePlugin, setRouterOption } from "../../utils/vite-config.ts";
import { addToWorkspaces, isWorkspacePackage, offsetTo, shouldAddPlugin } from "../../utils/workspace.ts";
import { initGenerator } from "../init/generator.ts";
import type { ApplicationGeneratorSchema } from "./schema.js";

export type { ApplicationGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));

export interface NormalizedApplicationOptions {
  directory: string;
  name: string;
  template: "static" | "server" | "ui" | "minimal";
  adapter: "node" | "static";
  /** create-rivet `--deploy` platform target. */
  deploy?: DeployTarget;
  tailwind: boolean;
  unitTestRunner: "vitest" | "none";
  tags: string[];
  rivet: string;
  addPlugin: boolean;
}

export function normalizeApplicationOptions(tree: Tree, options: ApplicationGeneratorSchema): NormalizedApplicationOptions {
  const directory = options.directory.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!directory) throw new Error("application: directory is required (e.g. apps/web)");
  const name = options.name ?? names(directory.split("/").pop()!).fileName;
  const template = options.template ?? "static";
  const adapter = options.adapter ?? (template === "server" ? "node" : "static");
  const tailwind = options.tailwind ?? template !== "minimal";
  if (template === "ui" && !tailwind) throw new Error("application: the ui starter needs Tailwind (@rivetjs/ui styles are Tailwind v4)");
  if (template === "server" && adapter === "static")
    throw new Error("application: the server starter's form action needs a server; use --template=static for a prerendered site");
  const deploy = options.deploy;
  if (deploy !== undefined) {
    if (!findDeployTarget(deploy)) throw new Error(`application: unknown deploy target "${deploy}"`);
    const problem = deployProblem(deploy, template);
    if (problem) throw new Error(`application: ${problem}`);
  }
  if (getProjects(tree).has(name)) throw new Error(`application: a project named "${name}" already exists`);
  if (tree.exists(directory) && tree.children(directory).length) throw new Error(`application: ${directory} is not empty`);
  return {
    directory,
    name,
    template,
    adapter,
    ...(deploy ? { deploy } : {}),
    tailwind,
    unitTestRunner: options.unitTestRunner ?? "vitest",
    tags: (options.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    rivet: rivetRange(options.rivetVersion),
    addPlugin: shouldAddPlugin(tree, options.addPlugin),
  };
}

/** Static ↔ node: router `mode`, the preview / prerender scripts of the matching starter. */
function applyAdapter(tree: Tree, o: NormalizedApplicationOptions): void {
  const vite = joinPathFragments(o.directory, "vite.config.ts");
  const isStatic = o.template !== "server";
  if ((o.adapter === "static") === isStatic) return;
  // A static starter served by Node: no prerender step, the server starter's serve.js.
  tree.write(vite, setRouterOption(tree.read(vite, "utf8")!, "mode", undefined).replace(/\/\/ Pages in src\/routes are rendered to HTML files[^\n]*\n/, ""));
  tree.delete(joinPathFragments(o.directory, "prerender.js"));
  tree.write(joinPathFragments(o.directory, "serve.js"), starterFile("server", "serve.js"));
}

const TAILWIND_IMPORT = 'import tailwindcss from "@tailwindcss/vite";';

/** Tailwind off for a Tailwind starter, or on for the minimal one. */
function applyTailwind(tree: Tree, o: NormalizedApplicationOptions, pkg: PackageJson): void {
  const vite = joinPathFragments(o.directory, "vite.config.ts");
  const styles = joinPathFragments(o.directory, "src/styles.css");
  const has = tree.read(vite, "utf8")!.includes("@tailwindcss/vite");
  if (o.tailwind === has) return;
  const dev = (pkg.devDependencies ??= {});
  if (!o.tailwind) {
    tree.write(vite, removePlugin(tree.read(vite, "utf8")!, "tailwindcss()", /@tailwindcss\/vite/));
    delete dev["tailwindcss"];
    delete dev["@tailwindcss/vite"];
    tree.write(styles, "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n");
    return;
  }
  let text = addImport(tree.read(vite, "utf8")!, TAILWIND_IMPORT);
  text = addPlugin(text, "tailwindcss()", "last");
  text = setRouterOption(text, "styles", '["src/styles.css"]');
  tree.write(vite, text);
  tree.write(styles, starterFile("static", "src/styles.css"));
  dev["tailwindcss"] = toolVersion("tailwindcss");
  dev["@tailwindcss/vite"] = toolVersion("@tailwindcss/vite");
}

/** The README section that maps the starter's npm scripts to Nx targets. */
function nxReadme(o: NormalizedApplicationOptions): string {
  const lines = [
    "",
    "## Nx",
    "",
    "In this workspace the package.json scripts are Nx targets:",
    "",
    `- \`nx dev ${o.name}\`: dev server`,
    `- \`nx build ${o.name}\`: client + server build${o.adapter === "static" ? ", then every page prerendered to `dist/client`" : ""} (cached)`,
    `- \`nx preview ${o.name}\`: serve the build`,
    `- \`nx check ${o.name}\` / \`nx typecheck ${o.name}\`: Rivet diagnostics / TypeScript`,
  ];
  if (o.unitTestRunner === "vitest") lines.push(`- \`nx test ${o.name}\`: Vitest`);
  if (o.deploy && deployScripts(o.deploy)["deploy"]) lines.push(`- \`nx deploy ${o.name}\`: build, then deploy (\`${deployScripts(o.deploy)["deploy"]}\`)`);
  lines.push(`- \`nx g @rivetjs/nx:route <path> --project=${o.name}\`, \`nx g @rivetjs/nx:component <Name> --project=${o.name}\`: new route / component`, "");
  return lines.join("\n");
}

export async function applicationGenerator(tree: Tree, schema: ApplicationGeneratorSchema): Promise<GeneratorCallback> {
  const o = normalizeApplicationOptions(tree, schema);
  await initGenerator(tree, {
    addPlugin: o.addPlugin,
    skipFormat: true,
    skipInstall: true,
    ...(schema.rivetVersion ? { rivetVersion: schema.rivetVersion } : {}),
    ...(schema.skipPackageJson ? { skipPackageJson: true } : {}),
  });

  writeStarter(tree, o.template, o.directory, o.name, o.rivet);
  const pkgPath = joinPathFragments(o.directory, "package.json");
  let pkg = readJson<PackageJson>(tree, pkgPath);
  // Nx targets replace the npm scripts (inferred from vite.config.ts, or written to project.json below).
  delete pkg["scripts"];
  applyAdapter(tree, o);
  applyTailwind(tree, o, pkg);
  // After the adapter / Tailwind edits: the overlay edits the final vite.config.ts (as create-rivet does after copying).
  if (o.deploy) pkg = applyDeploy(tree, o.directory, o.template, o.deploy, o.name, pkg);
  if (o.unitTestRunner === "vitest") {
    generateFiles(tree, joinPathFragments(FILES, "vitest"), o.directory, {});
    generateFiles(tree, joinPathFragments(FILES, "tests", o.template), o.directory, {});
    const dev = (pkg.devDependencies ??= {});
    dev["@rivetjs/testing"] = o.rivet;
    dev["vitest"] = VITEST_VERSION;
    dev["happy-dom"] = HAPPY_DOM_VERSION;
  }
  writeJson(tree, pkgPath, pkg);
  const readme = joinPathFragments(o.directory, "README.md");
  if (tree.exists(readme)) tree.write(readme, tree.read(readme, "utf8")!.replace(/\n*$/, "\n") + nxReadme(o));

  const facts = treeFacts(tree, o.directory);
  writeJson(tree, joinPathFragments(o.directory, "project.json"), {
    name: o.name,
    $schema: `${offsetTo(o.directory)}/node_modules/nx/schemas/project-schema.json`,
    projectType: "application",
    sourceRoot: `${o.directory}/src`,
    tags: o.tags,
    // Inferred by @rivetjs/nx/plugin; written out when inference is off.
    targets: o.addPlugin || !facts ? {} : rivetTargets(facts),
  });

  // Package-based workspaces install the app's own package.json; others get its dependencies at the root.
  addToWorkspaces(tree, o.directory);
  const workspacePackage = isWorkspacePackage(tree, o.directory);
  if (!schema.skipPackageJson && !workspacePackage) addDependenciesToPackageJson(tree, pkg.dependencies ?? {}, pkg.devDependencies ?? {});
  if (!schema.skipFormat) await formatFiles(tree);
  // One install after the files are written (a workspace package changes no root manifest: always run then).
  return schema.skipInstall ? () => {} : () => installPackagesTask(tree, workspacePackage);
}

export default applicationGenerator;

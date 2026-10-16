// `nx g @rivetjs/nx:library libs/ui-kit [--publishable] [--subpaths=button,card]`: a Rivet component library.
// Consumed from source inside the workspace (package manager workspaces resolve its `exports` to `.ts` / `.tsx`, the
// app's Rivet compiler compiles them); `--publishable` adds the package build for npm.
import { fileURLToPath } from "node:url";
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  getProjects,
  installPackagesTask,
  joinPathFragments,
  names,
  readJson,
  readNxJson,
  writeJson,
  type GeneratorCallback,
  type TargetConfiguration,
  type Tree,
} from "@nx/devkit";
import { treeFacts } from "../../utils/facts.ts";
import { rivetTargets } from "../../utils/targets.ts";
import { HAPPY_DOM_VERSION, rivetRange, VITEST_VERSION } from "../../utils/versions.ts";
import { addToWorkspaces, isWorkspacePackage, offsetTo, shouldAddPlugin } from "../../utils/workspace.ts";
import { initGenerator } from "../init/generator.ts";
import type { LibraryGeneratorSchema } from "./schema.js";

export type { LibraryGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));
const VITEST = fileURLToPath(new URL("../application/files/vitest", import.meta.url));

type Exports = Record<string, { types: string; default: string }>;

/** `.` + one entry per subpath, pointing at the sources (the package build maps them to the emitted files). */
export function libraryExports(subpaths: string[]): Exports {
  const exports: Exports = { ".": { types: "./src/index.ts", default: "./src/index.ts" } };
  for (const subpath of subpaths) exports[`./${subpath}`] = { types: `./src/${subpath}/index.ts`, default: `./src/${subpath}/index.ts` };
  return exports;
}

/** `@scope/name` with the root package.json's scope (`@proj/source` → `@proj`). */
export function defaultImportPath(tree: Tree, name: string): string {
  const root = tree.exists("package.json") ? readJson<{ name?: string }>(tree, "package.json").name : undefined;
  const scope = root?.startsWith("@") ? root.split("/")[0] : undefined;
  return scope ? `${scope}/${name}` : name;
}

export async function libraryGenerator(tree: Tree, schema: LibraryGeneratorSchema): Promise<GeneratorCallback> {
  const directory = schema.directory.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!directory) throw new Error("library: directory is required (e.g. libs/ui-kit)");
  const name = schema.name ?? names(directory.split("/").pop()!).fileName;
  if (getProjects(tree).has(name)) throw new Error(`library: a project named "${name}" already exists`);
  if (tree.exists(directory) && tree.children(directory).length) throw new Error(`library: ${directory} is not empty`);
  const importPath = schema.importPath ?? defaultImportPath(tree, name);
  const subpaths = (schema.subpaths ?? "")
    .split(",")
    .map((subpath) => names(subpath.trim()).fileName)
    .filter(Boolean);
  const publishable = Boolean(schema.publishable);
  const vitest = (schema.unitTestRunner ?? "vitest") === "vitest";
  const rivet = rivetRange(schema.rivetVersion);
  const addPlugin = shouldAddPlugin(tree, schema.addPlugin);
  const outputPath = `dist/${directory}`;
  const { className, fileName } = names(name);

  await initGenerator(tree, {
    addPlugin,
    skipFormat: true,
    skipInstall: true,
    ...(schema.rivetVersion ? { rivetVersion: schema.rivetVersion } : {}),
    ...(schema.skipPackageJson ? { skipPackageJson: true } : {}),
  });
  const vars = {
    name,
    importPath,
    className,
    fileName,
    publishable,
    rivet,
    outputPath,
    subpaths: subpaths.map((subpath) => names(subpath)),
    exportsJson: JSON.stringify(libraryExports(subpaths), null, 2).replace(/\n/g, "\n  "),
  };
  generateFiles(tree, joinPathFragments(FILES, "lib"), directory, vars);
  for (const subpath of subpaths) {
    generateFiles(tree, joinPathFragments(FILES, "subpath"), directory, { ...vars, subpath, subpathClass: names(subpath).className });
  }
  if (publishable) generateFiles(tree, joinPathFragments(FILES, "publishable"), directory, vars);
  const pkgPath = joinPathFragments(directory, "package.json");
  const pkg = readJson<{ devDependencies?: Record<string, string> }>(tree, pkgPath);
  if (vitest) {
    generateFiles(tree, VITEST, directory, {});
    generateFiles(tree, joinPathFragments(FILES, "vitest"), directory, vars);
    pkg.devDependencies = { "@rivetjs/testing": rivet, "happy-dom": HAPPY_DOM_VERSION, vitest: VITEST_VERSION };
    writeJson(tree, pkgPath, pkg);
  }

  const targets: Record<string, TargetConfiguration> = {};
  const facts = treeFacts(tree, directory);
  // Inference finds libraries through their Rivet vitest config; without one, check / typecheck go to project.json.
  if (!addPlugin || !facts) {
    Object.assign(
      targets,
      rivetTargets(facts ?? { kind: "lib", static: false, csr: false, test: false, tsconfig: true, serveScript: false, prerenderScript: false }),
    );
  }
  if (publishable) {
    targets["build"] = {
      executor: "@rivetjs/nx:package",
      cache: true,
      dependsOn: ["^build"],
      inputs: readNxJson(tree)?.namedInputs?.["production"]
        ? ["production", "^production"]
        : ["default", "^default", "!{projectRoot}/**/*.test.{ts,tsx}", "!{projectRoot}/vitest.config.{ts,mts,js,mjs}"],
      outputs: ["{options.outputPath}"],
      options: { tsConfig: "tsconfig.lib.json", outputPath },
    };
  }
  writeJson(tree, joinPathFragments(directory, "project.json"), {
    name,
    $schema: `${offsetTo(directory)}/node_modules/nx/schemas/project-schema.json`,
    projectType: "library",
    sourceRoot: `${directory}/src`,
    tags: (schema.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    targets,
  });

  addToWorkspaces(tree, directory);
  const workspacePackage = isWorkspacePackage(tree, directory);
  if (!schema.skipPackageJson) {
    addDependenciesToPackageJson(tree, { "@rivetjs/reactivity": rivet, "@rivetjs/runtime": rivet }, workspacePackage ? {} : (pkg.devDependencies ?? {}));
  }
  if (!schema.skipFormat) await formatFiles(tree);
  return schema.skipInstall ? () => {} : () => installPackagesTask(tree, workspacePackage);
}

export default libraryGenerator;

// `nx g @rivetjs/nx:i18n-setup web --locales=en,de`: compile-time i18n (`t()` calls are replaced per locale at build
// time). The inferred build target reads `locales` from i18n.config.ts: one client build per locale (`RIVET_LOCALE`).
import { fileURLToPath } from "node:url";
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  installPackagesTask,
  joinPathFragments,
  readJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from "@nx/devkit";
import { viteConfigPath } from "../../utils/facts.ts";
import { routedApp } from "../../utils/project.ts";
import { rivetRange } from "../../utils/versions.ts";
import { addImport, addPlugin } from "../../utils/vite-config.ts";
import { ensureLines, isWorkspacePackage } from "../../utils/workspace.ts";
import type { I18nSetupGeneratorSchema } from "./schema.js";

export type { I18nSetupGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));

/** A first catalog: one plain message and one with a plural (ICU MessageFormat). */
export function catalog(locale: string): Record<string, unknown> {
  const german = locale.startsWith("de");
  return german
    ? { home: { title: "Willkommen", items: "{count, plural, one {# Eintrag} other {# Einträge}}" } }
    : { home: { title: "Welcome", items: "{count, plural, one {# item} other {# items}}" } };
}

export async function i18nSetupGenerator(tree: Tree, options: I18nSetupGeneratorSchema): Promise<GeneratorCallback> {
  const project = routedApp(tree, options.project, "i18n-setup");
  const configFile = joinPathFragments(project.root, "i18n.config.ts");
  if (tree.exists(configFile)) throw new Error(`i18n-setup: ${configFile} already exists`);
  const locales = (options.locales ?? "en")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);
  if (!locales.length) throw new Error("i18n-setup: no locales");
  const defaultLocale = options.defaultLocale ?? locales[0]!;
  if (!locales.includes(defaultLocale)) throw new Error(`i18n-setup: defaultLocale "${defaultLocale}" is not in locales`);
  generateFiles(tree, FILES, project.root, { localesJson: JSON.stringify(locales), defaultLocale, prefix: options.prefix ?? "as-needed" });
  for (const locale of locales) {
    const path = joinPathFragments(project.root, "locales", `${locale}.json`);
    if (!tree.exists(path)) writeJson(tree, path, catalog(locale));
  }
  const vite = viteConfigPath(tree, project.root)!;
  let config = tree.read(vite, "utf8")!;
  config = addImport(config, 'import { i18n } from "@rivetjs/i18n/vite";');
  config = addImport(config, 'import { config as i18nConfig } from "./i18n.config.ts";');
  // i18n() runs before the router / compiler (`enforce: "pre"`); first in the list keeps that obvious.
  config = addPlugin(config, "i18n(i18nConfig)", "first");
  tree.write(vite, config);
  // Generated message types (`dts` default) are build output.
  ensureLines(tree, joinPathFragments(project.root, ".gitignore"), ["src/rivet-i18n.d.ts"]);

  let install: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    const deps = { "@rivetjs/i18n": rivetRange(options.rivetVersion) };
    const pkgPath = joinPathFragments(project.root, "package.json");
    if (tree.exists(pkgPath)) {
      const pkg = readJson<{ dependencies?: Record<string, string> }>(tree, pkgPath);
      pkg.dependencies = { ...pkg.dependencies, ...deps };
      writeJson(tree, pkgPath, pkg);
    }
    const workspacePackage = tree.exists(pkgPath) && isWorkspacePackage(tree, project.root);
    if (!workspacePackage) addDependenciesToPackageJson(tree, deps, {});
    install = () => installPackagesTask(tree, workspacePackage);
  }
  if (!options.skipFormat) await formatFiles(tree);
  return install;
}

export default i18nSetupGenerator;

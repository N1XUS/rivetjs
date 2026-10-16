// Versions written into generated projects. `@rivetjs/*` follow this package's own version (every Rivet package is
// released with the same version, like create-rivet); tool ranges come from the starter templates where they exist.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { templatesRoot, versionRange } from "create-rivet";

interface Manifest {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as Manifest;

/** This package's version (= every `@rivetjs/*` package of the same release). */
export const RIVET_NX_VERSION = own.version;
/** The `@nx/devkit` version this plugin is built against. */
export const NX_VERSION = own.dependencies?.["@nx/devkit"] ?? "23.2.1";

/** The range written for `@rivetjs/*` dependencies (`--rivetVersion` overrides): exact for prereleases, `^x.y.z` otherwise. */
export function rivetRange(override?: string): string {
  return override || versionRange(RIVET_NX_VERSION);
}

/** Test tooling ranges = `@rivetjs/testing` peer ranges (`tests/versions.test.ts` keeps them in sync). */
export const VITEST_VERSION = "^5.0.3";
export const HAPPY_DOM_VERSION = "^20.14.5";

/** Dependency ranges of a starter template's package.json (`starter-static`, …): the single source for tool versions. */
export function starterVersions(dir = "starter-static"): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(templatesRoot(), dir, "package.json"), "utf8")) as Manifest;
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

/** A tool range from the starters (`vite`, `typescript`, `tailwindcss`, …). Throws when no starter names it. */
export function toolVersion(name: string): string {
  for (const dir of ["starter-static", "starter-ui", "starter-server", "starter-minimal"]) {
    const range = starterVersions(dir)[name];
    if (range && !name.startsWith("@rivetjs/")) return range;
  }
  throw new Error(`@rivetjs/nx: no starter template names a version of ${name}`);
}

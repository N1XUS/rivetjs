// Release versions: every publishable lib (`libs/*` with `publishConfig.directory`) ships with ONE version.
// Pure helpers + manifest rewriting; `release.ts` drives them.
import { existsSync, globSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");

/** Publish order: dependencies before dependents (a registry install of a fresh version needs its deps first). */
export const ORDER = [
  "reactivity",
  "runtime",
  "compiler",
  "router",
  "kit",
  "forms",
  "i18n",
  "testing",
  "language-core",
  "devtools",
  "typescript-plugin",
  "mcp",
  "cdk",
  "ui",
  "motion",
  // Framework bridges: bridge (peers compiler / runtime / reactivity), then the adapters (peer bridge).
  "bridge",
  "bridge-react",
  "bridge-preact",
  "bridge-solid",
  "bridge-vue",
  "bridge-svelte",
  "create-rivet",
  "nx",
];

export interface Lib {
  /** `libs/<dir>` */
  dir: string;
  name: string;
  version: string;
  /** Where `scripts/package/build.ts` writes it (`publishConfig.directory`, absolute). */
  dist: string;
}

type Manifest = Record<string, unknown> & { name: string; version: string; publishConfig?: { directory?: string } };

const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Manifest;

/** Libs with `publishConfig.directory`, in {@link ORDER} (unknown ones last, alphabetically). */
export function publishableLibs(root = ROOT): Lib[] {
  const libs: Lib[] = [];
  for (const dir of readdirSync(join(root, "libs")).sort()) {
    const file = join(root, "libs", dir, "package.json");
    if (!existsSync(file)) continue;
    const pkg = read(file);
    const out = pkg.publishConfig?.directory;
    if (!out) continue;
    libs.push({ dir, name: pkg.name, version: pkg.version, dist: resolve(root, "libs", dir, out) });
  }
  const rank = (dir: string) => (ORDER.includes(dir) ? ORDER.indexOf(dir) : ORDER.length);
  return libs.sort((a, b) => rank(a.dir) - rank(b.dir) || a.dir.localeCompare(b.dir));
}

/** The one current version; throws when the libs disagree. */
export function currentVersion(libs: Lib[]): string {
  const versions = new Set(libs.map((lib) => lib.version));
  if (versions.size !== 1) throw new Error(`libs disagree on the version: ${libs.map((lib) => `${lib.name}@${lib.version}`).join(", ")}`);
  return [...versions][0]!;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/**
 * Next version: an explicit `x.y.z[-pre]`, or `major` / `minor` / `patch` / `prerelease` (with `preid`, default `alpha`).
 * `0.0.0-experimental` (never released) → `minor` = `0.1.0`, `prerelease` = `0.1.0-alpha.0`.
 */
export function nextVersion(current: string, bump: string, preid = "alpha"): string {
  if (SEMVER.test(bump)) return bump;
  const match = SEMVER.exec(current);
  if (!match) throw new Error(`not a semver version: ${current}`);
  let [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const pre = match[4];
  // The workspace placeholder is not a release: count it as "nothing released yet".
  const unreleased = major === 0 && minor === 0 && patch === 0;
  switch (bump) {
    case "major":
      return pre && !unreleased && minor === 0 && patch === 0 ? `${major}.0.0` : `${major + 1}.0.0`;
    case "minor":
      return pre && !unreleased && patch === 0 ? `${major}.${minor}.0` : `${major}.${minor + 1}.0`;
    case "patch":
      return pre && !unreleased ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
    case "prerelease": {
      if (unreleased) return `0.1.0-${preid}.0`;
      const same = pre?.startsWith(preid + ".") && /^\d+$/.test(pre.slice(preid.length + 1));
      if (same) return `${major}.${minor}.${patch}-${preid}.${Number(pre!.slice(preid.length + 1)) + 1}`;
      if (pre) return `${major}.${minor}.${patch}-${preid}.0`;
      return `${major}.${minor}.${patch + 1}-${preid}.0`;
    }
    default:
      throw new Error(`unknown bump "${bump}" (major | minor | patch | prerelease | x.y.z[-pre])`);
  }
}

/** `version` + every `@rivetjs/*` / `create-rivet` dependency spec (deps, peers, dev deps) → `version`. */
export function bumpManifest<T extends Record<string, unknown>>(pkg: T, version: string, names: Set<string>): T {
  const out: Record<string, unknown> = { ...pkg, version };
  for (const field of ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"]) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (deps) out[field] = Object.fromEntries(Object.entries(deps).map(([dep, spec]) => [dep, names.has(dep) ? version : spec]));
  }
  return out as T;
}

/** Rewrites `<dir>/package.json` with {@link bumpManifest} (keeps 2-space JSON + trailing newline). */
export function bumpFile(file: string, version: string, names: Set<string>): void {
  writeFileSync(file, JSON.stringify(bumpManifest(read(file), version, names), null, 2) + "\n");
}

/** Release versions and internal dependency specs must agree throughout the workspace and npm lockfile. */
export function bumpWorkspace(root: string, version: string): void {
  const libs = publishableLibs(root);
  const names = new Set(libs.map((lib) => lib.name));
  const workspace = read(join(root, "package.json")) as Manifest & { workspaces: string[] };
  const files = [
    "package.json",
    ...globSync(
      workspace.workspaces.map((pattern) => join(pattern, "package.json")),
      { cwd: root },
    ).sort(),
  ];
  const lockFile = join(root, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockFile, "utf8")) as { packages: Record<string, Record<string, unknown>> };
  const changes = new Map<string, string>();
  for (const file of files) {
    const pkg = read(join(root, file));
    const next = names.has(pkg.name) ? version : pkg.version;
    const key = file === "package.json" ? "" : dirname(file).split(sep).join("/");
    const entry = lock.packages[key];
    if (!entry) throw new Error(`package-lock.json is missing workspace ${key || "root"}`);
    const updated = JSON.stringify({ ...bumpManifest(pkg, version, names), version: next }, null, 2) + "\n";
    if (updated !== readFileSync(join(root, file), "utf8")) changes.set(file, updated);
    lock.packages[key] = { ...bumpManifest(entry, version, names), version: names.has(pkg.name) ? version : entry["version"] };
  }
  for (const [file, content] of changes) writeFileSync(join(root, file), content);
  writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n");
}

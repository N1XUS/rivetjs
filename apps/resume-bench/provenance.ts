import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stableRequire } from "./stable-dependencies.ts";

const root = dirname(fileURLToPath(import.meta.url));
const repository = resolve(root, "../..");
const definitions = {
  rivet: { label: "Rivet", releaseChannel: "experimental", runtime: "@rivetjs/runtime", packages: ["@rivetjs/runtime", "@rivetjs/reactivity", "@rivetjs/compiler", "vite"], rendering: "resume" },
  qwik: { label: "Qwik (preview)", releaseChannel: "preview", runtime: "@qwik.dev/core", packages: ["@qwik.dev/core", "vite"], rendering: "resume" },
  solid: { label: "Solid (preview)", releaseChannel: "preview", runtime: "solid-js", packages: ["solid-js", "@solidjs/web", "@solidjs/vite-plugin", "@solidjs/compiler", "vite"], rendering: "hydrate" },
  "qwik-stable": { label: "Qwik (stable)", releaseChannel: "stable", runtime: "@builder.io/qwik", packages: ["@builder.io/qwik", "vite"], rendering: "resume" },
  "rivet-derived": { label: "Rivet derived (spike S2)", releaseChannel: "experimental", runtime: "@rivetjs/runtime", packages: ["@rivetjs/runtime", "esbuild"], rendering: "derived" },
  "solid-stable": { label: "Solid (stable)", releaseChannel: "stable", runtime: "solid-js", packages: ["solid-js", "babel-preset-solid", "@babel/core", "vite-plugin-solid", "vite"], rendering: "hydrate" },
} as const;
export type Lane = keyof typeof definitions;
export const laneNames = Object.keys(definitions) as Lane[];
export const isLane = (lane: string): lane is Lane => Object.hasOwn(definitions, lane);

interface Fingerprint { path: string; sha256: string }
interface PackageInfo { name: string; version: string; root: string; entry: Fingerprint }
export interface BuildManifest {
  lane: Lane;
  label: string;
  releaseChannel: string;
  version: string;
  rendering: string;
  mode: "production";
  clientMinified: true;
  sourcemap: false;
  stableRegistryCheckedAt: string | null;
  packages: PackageInfo[];
  configuration: Record<string, unknown>;
  sources: Fingerprint[];
  artifacts: Fingerprint[];
}

async function hash(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".build", "target", "tests", "test", "oracle"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await files(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths.sort();
}
async function packageInfo(name: string, stable: boolean): Promise<PackageInfo> {
  const specifier = name === "@rivetjs/runtime" ? name + "/server-resume" : name;
  const entry = stable ? stableRequire.resolve(specifier) : fileURLToPath(import.meta.resolve(specifier));
  let directory = dirname(entry);
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as { name: string; version: string };
      if (pkg.name === name) return { name, version: pkg.version, root: relative(repository, directory), entry: { path: relative(repository, entry), sha256: await hash(entry) } };
    } catch {}
    const parent = dirname(directory);
    if (parent === directory) throw Error(`Cannot find package ${name}`);
    directory = parent;
  }
}

/** Save source/tool provenance only after the complete production output exists. */
export async function writeBuildManifest(lane: Lane, outDir: string): Promise<void> {
  const definition = definitions[lane];
  const stable = lane.endsWith("-stable");
  const packages = await Promise.all(definition.packages.map((name) => packageInfo(name, stable)));
  const sourcePaths = [
    ...await files(resolve(root, "lanes", lane)),
    // Real-page builds (dist/real/<lane>/<page>) are generated from real-pages/; micro builds do not depend on it.
    ...(relative(resolve(root, "dist/real"), outDir).startsWith("..") ? [] : await files(resolve(root, "real-pages"))),
    ...["data.ts", "provenance.ts", "stable-dependencies.ts", "package.json"].map((path) => resolve(root, path)),
    resolve(repository, "package.json"), resolve(repository, "package-lock.json"),
    ...(stable ? [resolve(repository, "apps/bench-stable/package.json")] : []),
    ...(lane === "rivet" ? (await Promise.all(["compiler", "runtime", "reactivity"].map((lib) => files(resolve(repository, "libs", lib))))).flat().filter((path) => /\.(?:ts|tsx|js|wasm|json|rs)$/.test(path)) : []),
  ];
  const manifest: BuildManifest = {
    lane, label: definition.label, releaseChannel: definition.releaseChannel,
    version: packages.find((pkg) => pkg.name === definition.runtime)!.version,
    rendering: definition.rendering, mode: "production", clientMinified: true, sourcemap: false,
    stableRegistryCheckedAt: stable ? "2026-10-04" : null,
    packages,
    configuration: lane === "solid-stable"
      ? { compiler: "babel-preset-solid", ssr: true, dev: false, hot: false, clientApi: "hydrate", serverApi: "renderToStringAsync", dataApi: "createResource", runtimeResolution: "explicit stable aliases (including transitive solid-js imports)" }
      : lane === "solid"
        ? { compiler: "@solidjs/vite-plugin", ssr: true, clientApi: "hydrate", serverApi: "renderToStream", dataApi: "createMemo" }
        : lane.startsWith("qwik")
          ? { compiler: "qwikVite", serverApi: "renderToString", loader: "framework default", scrollListener: lane === "qwik-stable" ? "useOnWindow (stable API has no per-hook passive option)" : "useOnWindow (passive: true)" }
          : lane === "rivet-derived"
            ? { compiler: "hand-written (spike S2: derived client)", loader: "inline, holds events, idle fetch-ahead, evaluate on input", runtime: "none" }
            : { compiler: "@rivetjs/compiler/vite", resume: true },
    sources: await Promise.all([...new Set(sourcePaths)].sort().map(async (path) => ({ path: relative(repository, path), sha256: await hash(path) }))),
    artifacts: await Promise.all((await files(outDir)).filter((path) => !path.endsWith("/build-manifest.json")).map(async (path) => ({ path: relative(outDir, path), sha256: await hash(path) }))),
  };
  await writeFile(resolve(outDir, "build-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

/** Reject stale output instead of attributing old bundles to newly installed versions. */
export async function readBuildManifest(lane: Lane, outDir: string): Promise<BuildManifest> {
  const manifest = JSON.parse(await readFile(resolve(outDir, "build-manifest.json"), "utf8")) as BuildManifest;
  if (manifest.lane !== lane || manifest.mode !== "production") throw Error(`Invalid ${lane} build manifest; rebuild with --build`);
  for (const entry of [...manifest.sources, ...manifest.packages.map((pkg) => pkg.entry)])
    if (await hash(resolve(repository, entry.path)) !== entry.sha256) throw Error(`${lane} source changed: ${entry.path}; rebuild with --build`);
  for (const entry of manifest.artifacts)
    if (await hash(resolve(outDir, entry.path)) !== entry.sha256) throw Error(`${lane} artifact changed: ${entry.path}; rebuild with --build`);
  return manifest;
}

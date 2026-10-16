import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Plugin } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
export const stableRoot = resolve(root, "../bench-stable");
export const stableRequire = createRequire(resolve(stableRoot, "package.json"));

/** Read the installed package's own manifest, including packages that do not export package.json. */
export async function stablePackage(name: string): Promise<{ directory: string; version: string }> {
  let directory = dirname(stableRequire.resolve(name));
  for (;;) {
    try {
      const info = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as { name?: string; version?: string };
      if (info.name === name && info.version) return { directory, version: info.version };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Missing stable package version for ${name}`);
    directory = parent;
  }
}

/** Resolve framework imports from the stable workspace, preserving esbuild's ESM/node conditions. */
export const stableResolver: Plugin = {
  name: "stable-framework-workspace",
  setup(builder) {
    builder.onResolve({ filter: /^(?:solid-js|@builder\.io\/qwik)(?:\/|$)/ }, args => {
      if (args.pluginData?.stableWorkspace) return;
      return builder.resolve(args.path, { kind: args.kind, resolveDir: stableRoot, pluginData: { stableWorkspace: true } });
    });
    builder.onResolve({ filter: /^@(?:solidjs\/|qwik\.dev\/)/ }, args => {
      throw new Error(`Preview framework import in stable bundle: ${args.path}`);
    });
  },
};

/** Compile the same explicit JSX fields with Solid 1's production SSR compiler (`hydratable: false` = static
 * markup without hydration keys, the like-for-like peer of non-resumable Rivet / Razor output). */
function solidCompiler(hydratable: boolean): Plugin {
  return {
    name: `solid-stable-production-ssr${hydratable ? "" : "-static"}`,
    setup(builder) {
      builder.onLoad({ filter: /\.jsx$/ }, async args => {
        const { transformAsync } = stableRequire("@babel/core");
        const result = await transformAsync(await readFile(args.path, "utf8"), {
          filename: args.path,
          babelrc: false,
          configFile: false,
          presets: [[stableRequire.resolve("babel-preset-solid"), { generate: "ssr", hydratable }]],
        });
        if (!result?.code) throw new Error(`Stable Solid compiler produced no code: ${args.path}`);
        return { contents: result.code, loader: "js", resolveDir: dirname(args.path) };
      });
    },
  };
}
export const stableSolidCompiler = solidCompiler(true);
export const stableSolidStaticCompiler = solidCompiler(false);

/** Qwik 1 keeps its own optimizer, Vite 7, generated client manifest, and asset directory. */
export async function buildStableQwik(): Promise<string[]> {
  const { build } = await import(pathToFileURL(stableRequire.resolve("vite")).href);
  const { qwikVite } = stableRequire("@builder.io/qwik/optimizer");
  const options = {
    srcDir: resolve(root, "adapters"),
    lint: false,
    fileFilter: (id: string) => !id.includes("solid") && !id.includes("rivet-compiled") && !/\/qwik(?:-page)?\.jsx/.test(id),
    client: { input: resolve(root, "adapters/qwik-stable-page.jsx"), outDir: resolve(root, "dist/client-stable") },
    ssr: { input: resolve(root, "adapters/qwik-stable.jsx"), outDir: resolve(root, "dist/qwik-stable-server") },
  };
  const shared = { configFile: false, root: stableRoot, resolve: { dedupe: ["@builder.io/qwik"] } };
  await build({ ...shared, plugins: qwikVite(options), build: { minify: true, emptyOutDir: true } });
  const result = await build({ ...shared, plugins: qwikVite(options), build: { ssr: true, minify: true, emptyOutDir: true } });
  const inputs = new Set<string>();
  for (const output of Array.isArray(result) ? result : [result])
    for (const chunk of output.output)
      if (chunk.type === "chunk") for (const id of Object.keys(chunk.modules)) inputs.add(id);
  return [...inputs];
}

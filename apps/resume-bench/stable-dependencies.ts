import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Resolve every stable tool from its isolated workspace, never from a preview lane. */
export const stableRequire = createRequire(new URL("../bench-stable/package.json", import.meta.url));

export function stablePackage(name: string) {
  let directory = dirname(stableRequire.resolve(name));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8")) as { name: string; version: string };
      if (pkg.name === name) return { name, version: pkg.version, root: directory };
    } catch {}
    const parent = dirname(directory);
    if (parent === directory) throw Error(`Cannot find stable package ${name}`);
    directory = parent;
  }
}

export const stableModule = (name: string) => pathToFileURL(stableRequire.resolve(name)).href;

/** Exact aliases also cover imports made inside solid-js/web and solid-js/store. */
export function stableSolidAliases(server = false) {
  const root = stablePackage("solid-js").root;
  return [
    { find: /^solid-js$/, replacement: resolve(root, `dist/${server ? "server" : "solid"}.js`) },
    { find: /^solid-js\/web$/, replacement: resolve(root, `web/dist/${server ? "server" : "web"}.js`) },
    { find: /^solid-js\/store$/, replacement: resolve(root, `store/dist/${server ? "server" : "store"}.js`) },
  ];
}

/** Fail a build if a stable lane ever includes the preview runtime through a transitive import. */
export function assertStableSolidModules(paths: Iterable<string>): void {
  const root = stablePackage("solid-js").root;
  let found = false;
  for (const path of paths) {
    const absolute = resolve(path);
    if (absolute.includes("/node_modules/@solidjs/web/")) throw Error(`Preview Solid web runtime in stable lane: ${path}`);
    if (!absolute.includes("/node_modules/solid-js/")) continue;
    if (!absolute.startsWith(root + "/")) throw Error(`Non-stable Solid runtime in stable lane: ${path}`);
    found = true;
  }
  if (!found) throw Error("Stable lane did not include its isolated Solid runtime");
}

export function stableSolidIsolation() {
  return {
    name: "assert-stable-solid-isolation",
    generateBundle(this: { getModuleIds(): IterableIterator<string> }) {
      assertStableSolidModules(this.getModuleIds());
    },
  };
}

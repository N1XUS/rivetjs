// Module graph of a site build: which repository source files it bundled, so `serve` rebuilds only when a
// library change can reach the site. Recorded by a Vite plugin (every module id the bundler loaded, all
// environments), stored as repo-relative POSIX paths without node_modules or build output.
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { writeAtomic } from "./lock.ts";

/** Site graph file (per app). */
export const SITE_GRAPH = ".artifacts/site-graph.json";

const SKIP = /(^|\/)(node_modules|dist|\.artifacts|\.rivet)\//;

/** Repo-relative POSIX path of a bundler module id, or null when it is not a repository source file. */
export function graphPath(id: string, repo: string): string | null {
  if (id.startsWith("\0")) return null;
  const file = id.replace(/[?#].*$/, "");
  if (!file.startsWith(repo + sep)) return null;
  const path = relative(repo, file).split(sep).join("/");
  return SKIP.test(path) ? null : path;
}

type Hook = ((this: object, ...args: unknown[]) => unknown) | { handler: (this: object, ...args: unknown[]) => unknown };
const WRAPPED = Symbol("docs-kit-graph");

/**
 * Vite plugin adding every loaded source module (repo-relative) to `into`, plus every file a plugin's `load` /
 * `transform` registers with `this.addWatchFile`: files read outside the module graph, e.g. the stylesheets
 * Tailwind inlines through `@import` (a `libs/ui/styles/components/*.css` edit changes every example's CSS without
 * being a module). Rolldown has no `getWatchFiles`, so the hooks run with a context that records the calls.
 */
export function graphPlugin(repo: string, into: Set<string>): Plugin {
  const add = (id: string) => {
    const path = graphPath(id, repo);
    if (path) into.add(path);
  };
  return {
    name: "docs-kit-graph",
    configResolved(config) {
      for (const plugin of config.plugins as unknown as Record<string, Hook | undefined>[])
        for (const name of ["load", "transform"]) {
          const hook = plugin[name];
          const original = typeof hook === "function" ? hook : hook?.handler;
          if (!hook || !original || (original as { [WRAPPED]?: boolean })[WRAPPED]) continue;
          const wrapped = Object.assign(
            function (this: object, ...args: unknown[]) {
              const context = new Proxy(this, {
                get(target, key) {
                  if (key === "addWatchFile")
                    return (file: string) => {
                      add(file);
                      return (target as { addWatchFile(file: string): void }).addWatchFile(file);
                    };
                  const value = Reflect.get(target, key) as unknown;
                  return typeof value === "function" ? value.bind(target) : value;
                },
              });
              return original.apply(context, args);
            },
            { [WRAPPED]: true },
          );
          if (typeof hook === "function") plugin[name] = wrapped;
          else hook.handler = wrapped;
        }
    },
    buildEnd() {
      for (const id of this.getModuleIds()) add(id);
    },
  };
}

export async function writeGraph(file: string, paths: Iterable<string>): Promise<void> {
  await writeAtomic(file, JSON.stringify([...paths].sort()) + "\n");
}

/** A recorded graph, or undefined when none was recorded (unknown: callers decide conservatively). */
export async function readGraph(file: string): Promise<Set<string> | undefined> {
  const text = await readFile(file, "utf8").catch(() => null);
  if (text === null) return undefined;
  try {
    return new Set(JSON.parse(text) as string[]);
  } catch {
    return undefined;
  }
}

export const siteGraphFile = (root: string) => resolve(root, SITE_GRAPH);

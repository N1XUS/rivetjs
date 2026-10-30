import { svelte as sveltePlugin, type Options } from "@sveltejs/vite-plugin-svelte";
import type { FilterPattern } from "vite";
import { ownership, type BridgeEntry } from "@rivetjs/bridge/vite";

export interface SvelteBridgeOptions {
  /** Additional Svelte-owned modules or packages. */
  include?: FilterPattern;
  exclude?: FilterPattern;
  /** Compiler/plugin options. CSS is always emitted through Vite. */
  plugin?: Options;
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

const list = (pattern: FilterPattern | undefined): (string | RegExp)[] =>
  pattern == null ? [] : typeof pattern === "string" || pattern instanceof RegExp ? [pattern] : [...pattern];

export function svelte(options: SvelteBridgeOptions = {}): BridgeEntry {
  const own = ownership({ name: "svelte", suffixes: [".svelte", ".svelte.ts", ".svelte.js"], include: options.include, exclude: options.exclude });
  return {
    name: "svelte",
    owns: own.owns,
    specifiers: own.specifiers,
    configure: own.configure,
    server: "@rivetjs/bridge-svelte/server",
    client: "@rivetjs/bridge-svelte/client",
    types: "@rivetjs/bridge-svelte/types",
    dedupe: ["svelte"],
    optimize: ["svelte"],
    ...(options.islands ? { islands: options.islands } : {}),
    plugins() {
      const plugin = options.plugin ?? {};
      return sveltePlugin({
        ...plugin,
        // Virtual bridge definition/client modules end in .svelte but contain JavaScript, not SFC syntax.
        exclude: [/^\0/, ...list(options.exclude ?? plugin.exclude)],
        emitCss: true,
        compilerOptions: { ...plugin.compilerOptions, css: "external" },
      });
    },
  };
}

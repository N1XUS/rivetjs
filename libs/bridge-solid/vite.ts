import solidPlugin, { type Options } from "vite-plugin-solid";
import type { FilterPattern, Plugin } from "vite";
import { ownership, type BridgeEntry } from "@rivetjs/bridge/vite";

export interface SolidBridgeOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  /** Native Solid plugin options. Hydratable SSR and direct event listeners are bridge invariants. */
  plugin?: Omit<Options, "include" | "exclude" | "ssr">;
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

/** Solid 1.9 islands, compiled by vite-plugin-solid in its native DOM or SSR mode per environment. */
export function solid(options: SolidBridgeOptions = {}): BridgeEntry {
  const own = ownership({ name: "solid", suffixes: [".solid.tsx", ".solid.jsx"], pragma: ["solid-js"], include: options.include, exclude: options.exclude });
  return {
    name: "solid",
    owns: own.owns,
    specifiers: own.specifiers,
    configure: own.configure,
    server: "@rivetjs/bridge-solid/server",
    client: "@rivetjs/bridge-solid/client",
    types: "@rivetjs/bridge-solid/types",
    dedupe: ["solid-js"],
    optimize: ["solid-js", "solid-js/store", "solid-js/web"],
    ...(options.islands ? { islands: options.islands } : {}),
    plugins() {
      // A broad native include lets the wrapper honor leading pragmas, folder rules and exclusions exactly as core does.
      const plugins = solidPlugin({
        ...options.plugin,
        include: /\.[jt]sx$/,
        exclude: [],
        ssr: true,
        solid: { ...options.plugin?.solid, hydratable: true, delegateEvents: false },
      });
      return (Array.isArray(plugins) ? plugins : [plugins]).map((plugin: Plugin) => {
        if (!plugin.transform) return plugin;
        const hook = plugin.transform;
        const handler = typeof hook === "function" ? hook : hook.handler;
        const transform: typeof handler = function (code, id, ...args) {
          if (!own.owns(id, code)) return null;
          return handler.call(this, code, id, ...args);
        };
        return { ...plugin, transform: typeof hook === "function" ? transform : { ...hook, handler: transform } };
      });
    },
  };
}

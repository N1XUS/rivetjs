// SFCs are Vue-owned. Its official Vite plugin handles compilation and scoped CSS; Rivet only generates facades.
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import type { FilterPattern, Plugin } from "vite";
import { ownership, type BridgeEntry } from "@rivetjs/bridge/vite";

export interface VueBridgeOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  /** Official @vitejs/plugin-vue options, or false when the app composes that plugin itself. */
  plugin?: false | Record<string, unknown>;
  /** Module exporting default setup(app). Relative paths resolve against the app root. Runs on server and client. */
  setup?: string;
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

function pluginVue(): (options?: Record<string, unknown>) => Plugin {
  for (const from of [join(process.cwd(), "package.json"), import.meta.url]) {
    try {
      const mod = createRequire(from)("@vitejs/plugin-vue") as { default?: unknown };
      return (typeof mod.default === "function" ? mod.default : mod) as (options?: Record<string, unknown>) => Plugin;
    } catch {
      /* try the app, then this adapter */
    }
  }
  throw new Error("@rivetjs/bridge-vue requires @vitejs/plugin-vue. Install it, or set plugin: false and compose your own Vue plugin.");
}

export function vue(options: VueBridgeOptions = {}): BridgeEntry {
  const own = ownership({ name: "vue", suffixes: [".vue"], include: options.include, exclude: options.exclude });
  let root = process.cwd();
  const server = "virtual:rivet-vue/server-adapter",
    client = "virtual:rivet-vue/client-adapter";
  return {
    name: "vue",
    owns: own.owns,
    specifiers: own.specifiers,
    configure(config) {
      root = config.root;
      own.configure(config);
    },
    server: options.setup ? server : "@rivetjs/bridge-vue/server",
    client: options.setup ? client : "@rivetjs/bridge-vue/client",
    types: "@rivetjs/bridge-vue/types",
    dedupe: ["vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue/reactivity", "@vue/shared"],
    optimize: ["vue"],
    ...(options.islands ? { islands: options.islands } : {}),
    plugins() {
      const plugins: Plugin[] = [];
      if (options.setup)
        plugins.push({
          name: "rivet:vue:setup",
          resolveId(id) {
            if (id === server || id === client) return "\0" + id;
          },
          load(id) {
            if (id !== "\0" + server && id !== "\0" + client) return null;
            const setup = options.setup!;
            const source = isAbsolute(setup) || setup.startsWith(".") ? resolve(root, setup) : setup;
            const adapter = id === "\0" + server ? "@rivetjs/bridge-vue/server" : "@rivetjs/bridge-vue/client";
            return `import { createAdapter } from ${JSON.stringify(adapter)};\nimport setup from ${JSON.stringify(source)};\nexport const adapter = createAdapter({ setup });\n`;
          },
        });
      if (options.plugin !== false) plugins.push(pluginVue()(options.plugin));
      return plugins;
    },
  };
}

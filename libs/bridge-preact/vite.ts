// @rivetjs/bridge-preact/vite — the `preact()` bridge entry for `rivet({ bridges: [preact()] })` (spec §4.1): Preact
// owns `*.preact.tsx` / `*.preact.jsx`, modules with a leading `@jsxImportSource preact` pragma, and the `include`
// folders / npm packages. Owned JSX modules without their own pragma get a leading `@jsxImportSource preact` line
// (`rivet:preact:jsx-source`): Vite's oxc transform then compiles them against `preact/jsx-runtime`.
// `@preact/preset-vite` (optional peer: Prefresh HMR, devtools) composes with the same filter when installed
// (`plugin: false` leaves it out). One Preact copy per page (`resolve.dedupe`), its client entries pre-bundled on the
// dev server.
import { createRequire } from "node:module";
import { join } from "node:path";
import type { FilterPattern, Plugin } from "vite";
import { jsxSource, ownership, type BridgeEntry } from "@rivetjs/bridge/vite";

export interface PreactBridgeOptions {
  /** More Preact modules: folder globs (`src/preact/**`), RegExps, npm packages by name. */
  include?: FilterPattern;
  /** Never Preact (wins over every other rule). */
  exclude?: FilterPattern;
  /** `@preact/preset-vite` options (its `include` / `exclude` default to this bridge's files), or `false`: not added. */
  plugin?: false | Record<string, unknown>;
  /** Island overrides (`BridgeEntry.islands`): `include` = islands although they do not look like components, `exclude` = not islands. */
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

const SUFFIXES = [".preact.tsx", ".preact.jsx"];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const list = (pattern: FilterPattern | undefined): (string | RegExp)[] =>
  pattern == null ? [] : Array.isArray(pattern) ? [...pattern] : [pattern as string | RegExp];

/** `@preact/preset-vite` from the app (sync `require`), or null when not installed. */
function presetPreact(): ((options: Record<string, unknown>) => Plugin[]) | null {
  for (const from of [join(process.cwd(), "package.json"), import.meta.url]) {
    try {
      const mod = createRequire(from)("@preact/preset-vite") as { default?: unknown; preact?: unknown };
      const factory = typeof mod.default === "function" ? mod.default : typeof mod.preact === "function" ? mod.preact : mod;
      return factory as (options: Record<string, unknown>) => Plugin[];
    } catch {
      // try the next location
    }
  }
  return null;
}

/** The Preact bridge entry. */
export function preact(options: PreactBridgeOptions = {}): BridgeEntry {
  const own = ownership({ name: "preact", suffixes: SUFFIXES, pragma: ["preact"], include: options.include, exclude: options.exclude });
  return {
    name: "preact",
    owns: own.owns,
    specifiers: own.specifiers,
    configure: own.configure,
    server: "@rivetjs/bridge-preact/server",
    client: "@rivetjs/bridge-preact/client",
    types: "@rivetjs/bridge-preact/types",
    dedupe: ["preact"],
    optimize: ["preact", "preact/hooks", "preact/jsx-runtime", "preact/jsx-dev-runtime"],
    ...(options.islands ? { islands: options.islands } : {}),
    plugins() {
      const source = jsxSource("preact", "preact", own.owns);
      if (options.plugin === false) return [source];
      const factory = presetPreact();
      if (!factory) return [source];
      const files = list(options.include).filter((entry) => typeof entry !== "string" || /[*?[\]{}!/]/.test(entry) || entry.startsWith("."));
      const include = [new RegExp("(" + SUFFIXES.map(escape).join("|") + ")$"), ...files];
      // The preset's own aliases (`react` → `preact/compat`) would capture a React bridge's imports: off by default.
      return [
        source,
        factory({ include, exclude: [/\/node_modules\//, ...list(options.exclude)], reactAliasesEnabled: false, ...(options.plugin ?? {}) }),
      ].flat();
    },
  };
}

// @rivetjs/bridge-react/vite — the `react()` bridge entry for `rivet({ bridges: [react()] })` (spec §4.1): React owns
// `*.react.tsx` / `*.react.jsx`, modules with a leading `@jsxImportSource react` pragma, and the `include` folders /
// npm packages; `@vitejs/plugin-react` (optional peer: Fast Refresh, React Compiler) composes with the same filter
// when installed (`plugin: false` leaves it out; Vite's own oxc transform compiles React JSX without it). One React
// copy per page (`resolve.dedupe`), its client entries pre-bundled on the dev server. Vite's oxc JSX options are global
// and a tsconfig `jsxImportSource` (`@rivetjs/runtime` in a Rivet app) wins over them, so every owned JSX module without
// its own pragma gets a leading `@jsxImportSource react` line (`react:jsx-source`, before oxc / plugin-react).
import { createRequire } from "node:module";
import { join } from "node:path";
import type { FilterPattern, Plugin } from "vite";
import { jsxSource, ownership, type BridgeEntry } from "@rivetjs/bridge/vite";

export interface ReactBridgeOptions {
  /** More React modules: folder globs (`src/react/**`), RegExps, npm packages by name (`@mui/material`). */
  include?: FilterPattern;
  /** Never React (wins over every other rule). */
  exclude?: FilterPattern;
  /** `@vitejs/plugin-react` options (its `include` / `exclude` default to this bridge's files), or `false`: not added. */
  plugin?: false | Record<string, unknown>;
  /** Island overrides (`BridgeEntry.islands`): `include` = islands although they do not look like components, `exclude` = not islands. */
  islands?: { include?: readonly string[]; exclude?: readonly string[] };
}

const SUFFIXES = [".react.tsx", ".react.jsx"];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const list = (pattern: FilterPattern | undefined): (string | RegExp)[] =>
  pattern == null ? [] : Array.isArray(pattern) ? [...pattern] : [pattern as string | RegExp];

/** `@vitejs/plugin-react` from the app (sync: `require` of its ESM build), or null when not installed. */
function pluginReact(): ((options: Record<string, unknown>) => Plugin[]) | null {
  for (const from of [join(process.cwd(), "package.json"), import.meta.url]) {
    try {
      const mod = createRequire(from)("@vitejs/plugin-react") as { default?: unknown };
      return (typeof mod.default === "function" ? mod.default : mod) as (options: Record<string, unknown>) => Plugin[];
    } catch {
      // try the next location
    }
  }
  return null;
}

/** The React bridge entry. */
export function react(options: ReactBridgeOptions = {}): BridgeEntry {
  const own = ownership({ name: "react", suffixes: SUFFIXES, pragma: ["react"], include: options.include, exclude: options.exclude });
  return {
    name: "react",
    owns: own.owns,
    specifiers: own.specifiers,
    configure: own.configure,
    server: "@rivetjs/bridge-react/server",
    client: "@rivetjs/bridge-react/client",
    types: "@rivetjs/bridge-react/types",
    dedupe: ["react", "react-dom"],
    optimize: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
    ...(options.islands ? { islands: options.islands } : {}),
    plugins() {
      const source = jsxSource("react", "react", own.owns);
      if (options.plugin === false) return [source];
      const factory = pluginReact();
      if (!factory) return [source];
      // Its filter: this bridge's suffixes + `include` files (pragma-owned modules get React JSX from the pragma).
      const files = list(options.include).filter((entry) => typeof entry !== "string" || /[*?[\]{}!/]/.test(entry) || entry.startsWith("."));
      const include = [new RegExp("(" + SUFFIXES.map(escape).join("|") + ")$"), ...files];
      return [source, factory({ include, exclude: [/\/node_modules\//, ...list(options.exclude)], ...(options.plugin ?? {}) })].flat();
    },
  };
}

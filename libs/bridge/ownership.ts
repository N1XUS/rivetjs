// JSX ownership (spec §4.1): which framework compiles a module. File conventions (`.vue`, `.svelte`, `*.react.tsx`, …),
// a leading `@jsxImportSource` pragma, and each bridge's `include` / `exclude` (folder globs; npm packages by import
// specifier). Everything else is Rivet. No content sniffing. A module two owners claim is a build error (RV2145).
import { relative, sep } from "node:path";
import { createFilter, type FilterPattern, type Plugin } from "vite";
import type { BridgeEntry } from "@rivetjs/compiler/vite";

/** Ownership rules of one framework (what an adapter's `vite.ts` passes to `ownership`). */
export interface OwnershipRules {
  /** Framework name (`react`): RV2145 messages. */
  name: string;
  /** File suffixes the framework owns (`.react.tsx`, `.react.jsx`, `.vue`). */
  suffixes: readonly string[];
  /** `@jsxImportSource` packages marking a file for the framework (`react`, `preact`, `solid-js`). */
  pragma?: readonly string[];
  /**
   * More modules: folder globs (relative to the Vite root, `src/react/**`) and RegExps match files; npm package names
   * (`@mui/material`, `recharts`) match import specifiers (the package and its subpaths).
   */
  include?: FilterPattern;
  /** Modules never owned (wins over every other rule). Globs / RegExps match files. */
  exclude?: FilterPattern;
}

/** What `ownership(rules)` gives an adapter's bridge entry. */
export interface Ownership {
  owns(id: string, source?: string): boolean;
  specifiers: (string | RegExp)[];
  configure(config: { root: string }): void;
}

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const GLOB = /[*?[\]{}!]/;

/** Whether an `include` string names an npm package (matched by import specifier) rather than a folder glob. */
export const isPackageName = (entry: string): boolean => !GLOB.test(entry) && !entry.startsWith(".") && !entry.startsWith("/") && NPM_NAME.test(entry);

/** The `@jsxImportSource` package of a module's leading comments (`react`), else null (classic `@jsx h` pragma: null). */
export function jsxImportSource(source: string): string | null {
  const head = /^(?:#![^\n]*\n)?(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/.exec(source)![0];
  return /@jsxImportSource\s+([^\s*]+)/.exec(head)?.[1] ?? null;
}

const list = (pattern: FilterPattern | undefined): (string | RegExp)[] =>
  pattern == null ? [] : Array.isArray(pattern) ? [...pattern] : [pattern as string | RegExp];

/** Ownership of one framework: `owns(file, source?)` + the npm specifiers it owns. Globs resolve against the Vite root. */
export function ownership(rules: OwnershipRules): Ownership {
  const include = list(rules.include);
  const exclude = list(rules.exclude);
  const specifiers = include.filter((entry): entry is string => typeof entry === "string" && isPackageName(entry));
  const files = include.filter((entry) => typeof entry !== "string" || !isPackageName(entry));
  let root = process.cwd();
  let included: ((id: string) => boolean) | null = null;
  let excluded: ((id: string) => boolean) | null = null;
  const filters = () => {
    // createFilter(include, exclude): `exclude` alone = "everything except"; here an exclude list matches what it lists.
    included ??= files.length ? createFilter(files, null, { resolve: root }) : () => false;
    excluded ??= exclude.length ? createFilter(exclude, null, { resolve: root }) : () => false;
  };
  return {
    specifiers,
    configure(config) {
      root = config.root;
      included = excluded = null;
    },
    owns(id, source) {
      const file = id.split("?", 1)[0]!;
      if (file.startsWith("\0")) return false;
      filters();
      if (excluded!(file)) return false;
      if (rules.suffixes.some((suffix) => file.endsWith(suffix))) return true;
      if (included!(file)) return true;
      if (source !== undefined && rules.pragma?.length) {
        const pkg = jsxImportSource(source);
        if (pkg !== null && rules.pragma.includes(pkg)) return true;
      }
      return false;
    },
  };
}

/** Whether an import specifier names one of the npm packages an entry owns (the package or a subpath). */
export function ownsSpecifier(entry: Pick<BridgeEntry, "specifiers">, specifier: string): boolean {
  return entry.specifiers.some((rule) => (typeof rule === "string" ? specifier === rule || specifier.startsWith(rule + "/") : rule.test(specifier)));
}

/** RV2145 error text. `other` = a second bridge; absent = the Rivet compiler's explicit `include`. */
export function conflictMessage(file: string, root: string, owner: string, other?: string): string {
  const path = relative(root, file).split(sep).join("/");
  return `[RV2145] ${path} matches both ${other ? `${owner}({ include }) and ${other}({ include })` : `the Rivet compiler and ${owner}({ include })`} — pick one owner`;
}

/** The entry owning a module (file rules, then a specifier for bare imports), else null; two owners → RV2145 error. */
export function ownerOf(entries: readonly BridgeEntry[], root: string, file: string, source?: string): BridgeEntry | null {
  let found: BridgeEntry | null = null;
  for (const entry of entries)
    if (entry.owns(file, source)) {
      if (found)
        throw Object.assign(new Error(conflictMessage(file, root, found.name, entry.name)), {
          code: "RV2145",
          plugin: "vite-plugin-rivet-bridge",
          pluginCode: "RV2145",
        });
      found = entry;
    }
  return found;
}

/** The entry owning a bare import specifier (npm package rules), else null; two owners → RV2145 error. */
export function specifierOwner(entries: readonly BridgeEntry[], specifier: string): BridgeEntry | null {
  let found: BridgeEntry | null = null;
  for (const entry of entries)
    if (ownsSpecifier(entry, specifier)) {
      if (found)
        throw Object.assign(
          new Error(`[RV2145] import "${specifier}" matches both ${found.name}({ include }) and ${entry.name}({ include }) — pick one owner`),
          {
            code: "RV2145",
            pluginCode: "RV2145",
          },
        );
      found = entry;
    }
  return found;
}

const JSX_FILE = /\.[jt]sx$/;

/**
 * `rivet:<name>:jsx-source` (enforce pre): prepends `/** @jsxImportSource <source> *\/` to owned `.tsx` / `.jsx`
 * modules that name no JSX import source themselves. Vite's oxc JSX options are global and a tsconfig
 * `jsxImportSource` (`@rivetjs/runtime` in a Rivet app) wins over them; oxc reads leading pragmas only. The map
 * shifts every line down by one (line-exact).
 */
export function jsxSource(name: string, source: string, owns: (id: string, code?: string) => boolean): Plugin {
  const pragma = "/** @jsxImportSource " + source + " */\n";
  return {
    name: "rivet:" + name + ":jsx-source",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0]!;
      if (!JSX_FILE.test(file) || file.includes("/node_modules/") || !owns(file, code) || /@jsxImportSource\s/.test(code)) return null;
      const lines = code.split("\n").length;
      return { code: pragma + code, map: { version: 3, sources: [file], names: [], mappings: ";AAAA" + ";AACA".repeat(lines - 1) } as never };
    },
  };
}

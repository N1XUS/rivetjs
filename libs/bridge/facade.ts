// Island facades (spec §4.2): the virtual Rivet module a Rivet file gets when it imports a framework module. Each
// component export becomes a Rivet component `_island(props, DEF.X, load_X)`, whose loader dynamically imports the
// island client module (component + client adapter); other exports are re-exported unchanged (server use; RV2146 warns
// in browser code). The facade text is the same for both environments (resume symbol ids agree): the per-environment
// parts (`_island` server / DOM variant, the island definitions) come from virtual imports resolved per environment.
import { readFile } from "node:fs/promises";
import { parseAst } from "vite";
import type { Rollup } from "vite";

/** One export of a framework module. `component`: wrapped as an island; else re-exported as is. */
export interface IslandExport {
  name: string;
  component: boolean;
  /** `export default Badge` of an exported component `Badge`: the facade's default is its `Badge` (one island). */
  alias?: string;
}

/** Virtual specifiers the facade imports (resolved per environment by `@rivetjs/bridge/vite`). */
export const CORE = "virtual:rivet-bridge/core";
export const DEF = "virtual:rivet-island-def:";
export const CLIENT = "virtual:rivet-island-client:";
export const PURE = "virtual:rivet-island-pure:";

/** A name that reads as a component: capitalized, not an ALL_CAPS constant. `default` is a component. */
export const componentName = (name: string): boolean => name === "default" || (/^[A-Z]/.test(name) && !/^[A-Z][A-Z0-9_]+$/.test(name));

/**
 * Wrapper calls whose result is a component (`memo(…)`, `React.forwardRef(…)`, `defineComponent(…)`, …): framework
 * entries add their own (`BridgeEntry.wrappers`).
 */
export const WRAPPERS: readonly string[] = ["memo", "forwardRef", "lazy", "observer", "defineComponent", "defineAsyncComponent", "defineCustomElement"];

/** How `exportList` decides which exports are components. */
export interface ExportOptions {
  /** More wrapper call names (callee identifier or member name) whose result is a component. */
  wrappers?: readonly string[];
}

type Node = { type: string; [key: string]: unknown };
const nameOf = (node: unknown): string => {
  const n = node as { type?: string; name?: string; value?: string } | null;
  return n?.type === "Literal" ? String(n.value) : (n?.name ?? "");
};
/** Unwraps parentheses and TS-only wrappers (`x as C`, `x satisfies C`, `x!`). */
const bare = (node: Node | null): Node | null => {
  let n = node;
  while (n && (n.type === "ParenthesizedExpression" || n.type === "TSAsExpression" || n.type === "TSSatisfiesExpression" || n.type === "TSNonNullExpression"))
    n = n.expression as Node;
  return n;
};
/** A local's value as far as it decides island-ness: a component, not one, or another binding to follow. */
type Kind = boolean | { ref: string };
const kindOf = (init: Node | null, wrappers: ReadonlySet<string>): Kind => {
  const n = bare(init);
  if (!n) return false;
  if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression" || n.type === "FunctionDeclaration") return true;
  if (n.type === "ClassExpression" || n.type === "ClassDeclaration") return n.superClass != null;
  if (n.type === "Identifier") return { ref: nameOf(n) };
  if (n.type === "CallExpression") {
    const callee = bare(n.callee as Node);
    const name = callee?.type === "Identifier" ? nameOf(callee) : callee?.type === "MemberExpression" ? nameOf(callee.property) : "";
    return wrappers.has(name);
  }
  return false;
};

/**
 * Export list of a framework module (its source): which exports are islands. A component = a capitalised name (not an
 * ALL_CAPS constant; `default` always qualifies) whose value is a function / a class that `extends` something (declaration or expression; a plain class is a
 * store or model, not a component) or a
 * known wrapper call (`WRAPPERS` + `options.wrappers`); a binding re-exported or imported is followed (`star` resolves
 * a specifier to that module's list). Schemas, stores, enums and other values stay plain re-exports. `export *` follows
 * `star` (`default` excluded). Type-only exports are skipped.
 */
export async function exportList(
  code: string,
  star: (specifier: string) => Promise<IslandExport[]>,
  lang: "js" | "jsx" | "ts" | "tsx" = "js",
  options: ExportOptions = {},
): Promise<IslandExport[]> {
  const wrappers = new Set([...WRAPPERS, ...(options.wrappers ?? [])]);
  const program = parseAst(code, { lang }) as unknown as { body: Node[] };
  const locals = new Map<string, Kind>(); // local name → its kind
  const imports = new Map<string, { source: string; name: string }>(); // local name → imported binding
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      if (node.importKind === "type") continue;
      for (const spec of (node.specifiers as Node[]) ?? []) {
        if (spec.importKind === "type") continue;
        const name = spec.type === "ImportDefaultSpecifier" ? "default" : spec.type === "ImportNamespaceSpecifier" ? "*" : nameOf(spec.imported);
        imports.set(nameOf(spec.local), { source: String((node.source as { value: string }).value), name });
      }
      continue;
    }
    const decl = (node.type === "ExportNamedDeclaration" ? node.declaration : node) as Node | null;
    if (!decl) continue;
    if (decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") locals.set(nameOf(decl.id), kindOf(decl, wrappers));
    else if (decl.type === "VariableDeclaration")
      for (const d of decl.declarations as Node[]) if ((d.id as Node).type === "Identifier") locals.set(nameOf(d.id), kindOf(d.init as Node | null, wrappers));
  }
  const lists = new Map<string, Promise<IslandExport[]>>();
  const listOf = (source: string) => {
    let list = lists.get(source);
    if (!list) lists.set(source, (list = star(source)));
    return list;
  };
  // A binding of an npm package (`export { Button } from "@ui/kit"`): not followed (package barrels are large), its name
  // decides; app modules are followed.
  const imported = async (source: string, name: string): Promise<boolean> =>
    name !== "*" && (!/^[./]/.test(source) || ((await listOf(source)).find((entry) => entry.name === name)?.component ?? false));
  const resolveKind = async (kind: Kind, depth = 0): Promise<boolean> => {
    if (typeof kind === "boolean") return kind;
    if (depth > 8) return false;
    const local = locals.get(kind.ref);
    if (local !== undefined) return resolveKind(local, depth + 1);
    const from = imports.get(kind.ref);
    return from ? imported(from.source, from.name) : false;
  };
  const out = new Map<string, boolean>();
  const aliases = new Map<string, string>(); // export name → the local it re-exports (`export default X`, `export { X as Y }`)
  const add = (name: string, value: boolean) => out.set(name, value && componentName(name));
  for (const node of program.body) {
    if (node.exportKind === "type") continue;
    if (node.type === "ExportDefaultDeclaration") {
      const decl = node.declaration as Node;
      if (decl.type === "Identifier") aliases.set("default", nameOf(decl));
      add("default", await resolveKind(kindOf(decl, wrappers)));
    } else if (node.type === "ExportNamedDeclaration") {
      const decl = node.declaration as Node | null;
      if (decl) {
        if (decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") add(nameOf(decl.id), kindOf(decl, wrappers) === true);
        else if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations as Node[])
            if ((d.id as Node).type === "Identifier") add(nameOf(d.id), await resolveKind(locals.get(nameOf(d.id)) ?? false));
        } else if (decl.type === "TSEnumDeclaration" || (decl.type === "TSModuleDeclaration" && decl.declare !== true)) add(nameOf(decl.id), false);
        continue;
      }
      for (const spec of (node.specifiers as Node[]) ?? []) {
        if (spec.exportKind === "type") continue;
        const exported = nameOf(spec.exported);
        const source = node.source ? String((node.source as { value: string }).value) : null;
        // `export { Panel as Board }` of a local also exported as itself: one island under two names (an alias).
        if (!source && nameOf(spec.local) !== exported) aliases.set(exported, nameOf(spec.local));
        add(exported, source ? await imported(source, nameOf(spec.local)) : await resolveKind({ ref: nameOf(spec.local) }));
      }
    } else if (node.type === "ExportAllDeclaration") {
      if (node.exported) add(nameOf(node.exported), false);
      else
        for (const entry of await listOf(String((node.source as { value: string }).value)))
          if (entry.name !== "default" && !out.has(entry.name)) out.set(entry.name, entry.component);
    }
  }
  const named = new Map<string, string>(); // local → its component export name (`export { X }`, declarations)
  for (const [name, component] of out) if (component && name !== "default") named.set(name, name);
  return [...out].map(([name, component]) => {
    const alias = aliases.get(name);
    return alias !== undefined && named.has(alias) ? { name, component, alias } : { name, component };
  });
}

/** Parser language of a framework module file, or null (an SFC / other format: its default export only). */
const langOf = (file: string): "js" | "jsx" | "ts" | "tsx" | null => {
  const ext = /\.([cm]?[jt]sx?)$/.exec(file)?.[1]?.replace(/^[cm]/, "");
  return ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx" ? ext : null;
};

/**
 * Export list of a framework module, read from its source file (the same text in every environment and build phase,
 * so the server and client facades agree; `export *` followed through `ctx.resolve`). Single-file components (`.vue`,
 * `.svelte`) export their component as `default`.
 */
export async function exportsOf(
  ctx: Pick<Rollup.PluginContext, "resolve">,
  id: string,
  options: ExportOptions = {},
  walk: { active: Set<string>; done: Map<string, Promise<IslandExport[]>> } = { active: new Set(), done: new Map() },
): Promise<IslandExport[]> {
  const file = id.split("?", 1)[0]!;
  if (walk.active.has(file)) return []; // an import cycle: the module being read decides its own exports
  const known = walk.done.get(file);
  if (known) return known;
  const lang = langOf(file);
  if (lang === null) return [{ name: "default", component: true }];
  walk.active.add(file);
  const list = readFile(file, "utf8")
    .then((code) =>
      exportList(
        code,
        async (specifier) => {
          const hit = await ctx.resolve(specifier, file);
          return hit && !hit.external && !hit.id.startsWith("\0") ? exportsOf(ctx, hit.id, options, walk) : [];
        },
        lang,
        options,
      ),
    )
    .finally(() => walk.active.delete(file));
  walk.done.set(file, list);
  return list;
}

const js = (value: string) => JSON.stringify(value);
const local = (name: string) => (name === "default" ? "Island" : name);

/** The facade TSX of a framework module (`target`: the module's facade name — resolved id, or `npm:<specifier>`). */
export function facadeSource(target: string, key: string, exports: readonly IslandExport[]): string {
  const components = exports.filter((entry) => entry.component);
  const plain = exports.filter((entry) => !entry.component);
  let out = `// Island facade of ${key} (@rivetjs/bridge/vite).\nimport { _island } from ${js(CORE)};\nimport * as DEF from ${js(DEF + target)};\n`;
  if (plain.length) out += `export { ${plain.map((entry) => entry.name).join(", ")} } from ${js(PURE + target)};\n`;
  for (const { name, alias } of components) {
    if (alias !== undefined) {
      out += `export { ${alias} as ${name} };\n`;
      continue;
    }
    const load = "load_" + name;
    out += `function ${load}() {\n  return import(${js(CLIENT + target + "?export=" + name)});\n}\n`;
    out += `export ${name === "default" ? "default " : ""}function ${local(name)}(props) {\n  return <>{_island(props, DEF[${js(name)}], ${load})}</>;\n}\n`;
  }
  return out;
}

/** Island definitions of the server environment: id, framework component, server adapter, chunk key. */
export function serverDefs(targetSpecifier: string, key: string, adapter: string, exports: readonly IslandExport[], head = false): string {
  let out = `import * as M from ${js(targetSpecifier)};\nimport { adapter } from ${js(adapter)};\n`;
  if (head) out += 'import { pushHead } from "@rivetjs/kit";\n';
  for (const { name } of exports.filter((entry) => entry.component && entry.alias === undefined)) {
    const id = key + "#" + name;
    out += `export const ${name === "default" ? "_default" : name} = { id: ${js(id)}, c: M[${js(name)}], a: adapter, chunk: ${js(id)}${head ? ", head: pushHead" : ""} };\n`;
  }
  if (exports.some((entry) => entry.name === "default" && entry.component && entry.alias === undefined)) out += "export { _default as default };\n";
  return out;
}

/** Island definitions of the browser: the id only (the loader brings the component and the client adapter). */
export function clientDefs(key: string, exports: readonly IslandExport[]): string {
  let out = "";
  for (const { name } of exports.filter((entry) => entry.component && entry.alias === undefined))
    out += `export const ${name === "default" ? "_default" : name} = { id: ${js(key + "#" + name)} };\n`;
  if (exports.some((entry) => entry.name === "default" && entry.component && entry.alias === undefined)) out += "export { _default as default };\n";
  return out || "export {};\n";
}

/** The island client module of one component export: what the loader imports (component + client adapter). */
export function islandModule(targetSpecifier: string, key: string, name: string, adapter: string, dev: boolean): string {
  let out = `export { ${name === "default" ? "default" : name + " as default"} } from ${js(targetSpecifier)};\nexport { adapter } from ${js(adapter)};\nexport const __rivetIsland = ${js(key + "#" + name)};\n`;
  // Dev: an edit of the framework module that its own HMR does not take (no Fast Refresh boundary) re-hydrates this
  // island's instances with the new component (`client.ts` dev registry), the Rivet page untouched.
  if (dev)
    out += `if (import.meta.hot) import.meta.hot.accept((next) => { if (next) globalThis.__rivetBridgeDev?.replace(next.__rivetIsland, next.default); });\n`;
  return out;
}

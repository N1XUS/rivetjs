// @rivetjs/bridge/vite — the bridge plugin `rivet({ bridges })` runs (libs/compiler/vite.ts `bridgeHost` loads it from
// the app): framework module ownership (`ownership.ts`), island facades (`facade.ts`) a Rivet importer gets instead
// of the framework module, per-environment island definitions + island client modules, `resolve.dedupe` /
// `optimizeDeps.include` per framework, export-list HMR, the per-page framework bytes report and RV2146. The facades
// are virtual (`\0rivet-island:<target>.tsx`): the compiler compiles them as Rivet modules, in resume mode when
// resuming (its `api.rivetBridges` hooks below).
import { readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";
import type { Plugin, ResolvedConfig, Rollup } from "vite";
import type { BridgeEntry, RivetBridgesApi } from "@rivetjs/compiler/vite";
import { parseAst } from "vite";
import { CLIENT, CORE, DEF, PURE, clientDefs, exportsOf, facadeSource, islandModule, serverDefs, type IslandExport } from "./facade.ts";
import { ownerOf, specifierOwner } from "./ownership.ts";

export type { BridgeEntry } from "@rivetjs/compiler/vite";
export { jsxSource, ownership, type Ownership, type OwnershipRules } from "./ownership.ts";

/** Facade module ids: `\0rivet-island:<target>.tsx` (`<target>` = resolved file, or `npm:<specifier>`). */
const FACADE = "\0rivet-island:";
const DEF_ID = "\0rivet-island-def:";
const CLIENT_ID = "\0rivet-island-client:";
const NPM = "npm:";

interface Facade {
  /** The facade's target name (resolved file or `npm:<specifier>`). */
  target: string;
  /** Island key module part: root-relative path (app files) or the npm specifier. */
  key: string;
  entry: BridgeEntry;
}

/** @internal The plugin behind `rivet({ bridges })` (one per Vite config; `entries` = the configured bridges). */
/** An `islands.include` / `exclude` list as a test: export names (`"Chart"`) or island-key patterns (`*` wildcard). */
const matcher = (patterns: readonly string[] | undefined): ((key: string, name: string) => boolean) | null => {
  if (!patterns?.length) return null;
  const tests = patterns.map((pattern) => {
    if (!pattern.includes("#")) return (_key: string, name: string) => name === pattern;
    const re = new RegExp(
      "^" +
        pattern
          .split("*")
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*") +
        "$",
    );
    return (key: string) => re.test(key);
  });
  return (key, name) => tests.some((test) => test(key, name));
};

export function bridgePlugin(entries: BridgeEntry[]): Plugin {
  let root = process.cwd(),
    serve = false,
    config: ResolvedConfig | null = null;
  const facades = new Map<string, Facade>(); // facade id → facade
  const exportCache = new Map<string, string>(); // target → JSON of its last export list (HMR)
  // Rivet importer + specifier → facade id or null: an owned-module check resolves the import once per pair (the
  // resolution Vite does next is its own). Dev: cleared when files are created / deleted.
  const resolved = new Map<string, string | null>();
  const uses = new Map<string, Set<string>>(); // facade id → "importer\0specifier" pairs that import it
  const sources = new Map<string, string | undefined>();
  const read = (file: string): string | undefined => {
    if (!sources.has(file)) sources.set(file, existsSync(file) ? readFileSync(file, "utf8") : undefined);
    return sources.get(file);
  };
  const posix = (path: string) => path.split(sep).join("/");
  const keyOf = (file: string) => {
    const local = posix(relative(root, file));
    // Root-relative, `../` included (a component folder next to the app): never the build machine's absolute path,
    // which would ship in the island def / module (`__rivetIsland`) and make content hashes machine-specific.
    if (!/(^|\/)node_modules\//.test(local) && !/^[A-Za-z]:|^\//.test(local)) return local;
    const at = posix(file).lastIndexOf("/node_modules/");
    return at >= 0 ? posix(file).slice(at + 14) : posix(file);
  };
  const owner = (file: string, source?: string) => ownerOf(entries, root, file, source ?? read(file));
  /** Facade of a target (registered once per target name). */
  const facadeId = (target: string, key: string, entry: BridgeEntry): string => {
    const id = FACADE + target + ".tsx";
    if (!facades.has(id)) facades.set(id, { target, key, entry });
    return id;
  };
  /** A facade id → its facade (rebuilt from the id after a dev restart). */
  const facadeOf = (id: string): Facade | null => {
    const known = facades.get(id);
    if (known) return known;
    if (!id.startsWith(FACADE) || !id.endsWith(".tsx")) return null;
    const target = id.slice(FACADE.length, -4);
    if (target.startsWith(NPM)) {
      const entry = specifierOwner(entries, target.slice(NPM.length));
      return entry ? (facades.set(id, { target, key: target.slice(NPM.length), entry }), facades.get(id)!) : null;
    }
    const entry = owner(target);
    return entry ? (facades.set(id, { target, key: keyOf(target), entry }), facades.get(id)!) : null;
  };
  /** Rivet modules importing a facade (symbol chunks / parts of the resume build stand for their modules). */
  const importersOf = (ctx: Rollup.PluginContext, facade: Facade): string[] =>
    (ctx.getModuleInfo(FACADE + facade.target + ".tsx")?.importers ?? []).filter((id) => !id.startsWith("\0")).map((id) => keyOf(id.split("?", 1)[0]!));
  const byTarget = (target: string) => [...facades.values()].find((facade) => facade.target === target) ?? null;
  const server = (ctx: { environment?: { config: { consumer?: string } } }, ssr?: boolean) => ssr ?? ctx.environment?.config.consumer === "server";
  /** How bridge modules import a target: npm targets by specifier, files by `PURE` (side-effect free in the browser). */
  const targetSpecifier = (facade: Facade) => (facade.target.startsWith(NPM) ? facade.target.slice(NPM.length) : PURE + facade.target);
  /** Islands of a framework module: its export list (`facade.ts`) + the entry's `islands.include` / `exclude` overrides. */
  const listOf = async (ctx: Pick<Rollup.PluginContext, "resolve">, facade: Facade, file: string): Promise<IslandExport[]> => {
    const list = await exportsOf(ctx, file, { wrappers: facade.entry.wrappers ?? [] });
    const include = matcher(facade.entry.islands?.include);
    const exclude = matcher(facade.entry.islands?.exclude);
    if (!include && !exclude) return list;
    return list.map((entry) => {
      const key = facade.key + "#" + entry.name;
      // An alias (`export default Foo`, `export { Foo as Bar }` of an exported component) follows an exclusion of
      // either name: it becomes a plain re-export (else the facade would alias a local the exclusion removed).
      if (entry.alias !== undefined)
        return entry.component && (exclude?.(key, entry.name) || exclude?.(facade.key + "#" + entry.alias, entry.alias))
          ? { name: entry.name, component: false }
          : entry;
      if (entry.component && exclude?.(key, entry.name)) return { ...entry, component: false };
      if (!entry.component && include?.(key, entry.name) && !exclude?.(key, entry.name)) return { ...entry, component: true };
      return entry;
    });
  };
  const exportsFor = async (ctx: Rollup.PluginContext, facade: Facade): Promise<IslandExport[]> => {
    let id = facade.target;
    if (id.startsWith(NPM)) {
      const hit = await ctx.resolve(id.slice(NPM.length), join(root, "index.html"), { skipSelf: true });
      if (!hit || hit.external) ctx.error(`[rivet:bridge] cannot resolve ${id.slice(NPM.length)}`);
      id = hit!.id;
    }
    const list = await listOf(ctx, facade, id);
    exportCache.set(facade.target, JSON.stringify(list));
    return list;
  };
  /** Records a Rivet import of a facade (the unused-islands report reads the importer's bindings). */
  const used = (id: string, from: string, source: string): string => {
    let set = uses.get(id);
    if (!set) uses.set(id, (set = new Set()));
    set.add(from + "\0" + source);
    return id;
  };
  /** Export names a Rivet module imports through `specifier` (`*`: all of them — namespace, `export *`, `import()`). */
  const importedNames = (file: string, specifier: string): Set<string> => {
    const names = new Set<string>();
    const code = read(file);
    const lang = /\.([cm]?[jt]sx?)$/.exec(file)?.[1]?.replace(/^[cm]/, "") as "js" | "jsx" | "ts" | "tsx" | undefined;
    if (code === undefined || !lang) return names.add("*");
    type Node = { type: string; [key: string]: unknown };
    let body: Node[];
    try {
      body = (parseAst(code, { lang }) as unknown as { body: Node[] }).body;
    } catch {
      return names.add("*");
    }
    const name = (node: unknown) => {
      const n = node as { type?: string; name?: string; value?: string };
      return n.type === "Literal" ? String(n.value) : (n.name ?? "");
    };
    for (const node of body) {
      if ((node.source as { value?: string } | null)?.value !== specifier) continue;
      if (node.type === "ExportAllDeclaration") names.add("*");
      for (const spec of (node.specifiers as Node[] | undefined) ?? [])
        names.add(spec.type === "ImportDefaultSpecifier" ? "default" : spec.type === "ImportNamespaceSpecifier" ? "*" : name(spec.imported ?? spec.local));
    }
    if (code.includes("import(" + JSON.stringify(specifier)) || code.includes("import('" + specifier + "'")) names.add("*");
    return names;
  };
  const facadeText = async (ctx: Rollup.PluginContext, id: string): Promise<string> => {
    const facade = facadeOf(id);
    if (!facade) ctx.error(`[rivet:bridge] unknown island facade ${id}`);
    return facadeSource(facade!.target, facade!.key, await exportsFor(ctx, facade!));
  };
  // Dev: island key → its client module id (the dev manifest's `islands`).
  const islandModuleOf = (key: string): string | undefined => {
    const hash = key.lastIndexOf("#");
    const module = key.slice(0, hash);
    for (const facade of facades.values()) if (facade.key === module) return CLIENT_ID + facade.target + "?export=" + key.slice(hash + 1);
    return undefined;
  };

  const api: RivetBridgesApi = {
    owner: (file, source) => owner(file, source),
    facade: (id) => id.startsWith(FACADE) && id.endsWith(".tsx") && !id.includes("?"),
    source: (ctx, id) => facadeText(ctx, id),
    module: (id) => (facadeOf(id)?.key ?? id.slice(FACADE.length, -4)) + ".island",
    sources: (id) => {
      const facade = facadeOf(id);
      return facade && !facade.target.startsWith(NPM) ? [facade.target] : [];
    },
    islandKey: (id) => {
      if (!id.startsWith(CLIENT_ID)) return null;
      const [target = "", query = ""] = id.slice(CLIENT_ID.length).split("?", 2);
      const facade = byTarget(target);
      const name = new URLSearchParams(query).get("export");
      return facade && name ? facade.key + "#" + name : null;
    },
    islandModule: islandModuleOf,
    seeds: () => [fileURLToPath(new URL("./root.tsx", import.meta.url))],
  };

  return {
    name: "rivet:bridge",
    enforce: "pre",
    api: { rivetBridges: api },
    config(_, env) {
      const dedupe = [...new Set(entries.flatMap((entry) => entry.dedupe ?? []))];
      const include = [...new Set(entries.flatMap((entry) => entry.optimize ?? []))];
      return {
        ...(dedupe.length ? { resolve: { dedupe } } : {}),
        ...(env.command === "serve" && include.length ? { optimizeDeps: { include } } : {}),
      };
    },
    configResolved(resolved) {
      config = resolved;
      root = resolved.root;
      serve = resolved.command === "serve";
      for (const entry of entries) entry.configure?.({ root, command: resolved.command });
    },
    async resolveId(source, importer, options) {
      if (source.startsWith(FACADE) || source.startsWith(DEF_ID) || source.startsWith(CLIENT_ID)) return source;
      const ssr = server(this, options?.ssr);
      if (source === CORE) return this.resolve(ssr ? "@rivetjs/bridge/server" : "@rivetjs/bridge/dom", join(root, "index.html"), { skipSelf: true });
      if (source.startsWith(DEF)) return DEF_ID + source.slice(DEF.length);
      if (source.startsWith(CLIENT)) return CLIENT_ID + source.slice(CLIENT.length);
      if (source.startsWith(PURE)) {
        const target = source.slice(PURE.length);
        // Browser: the framework module only where an island (or a used re-export) needs it.
        return ssr ? target : { id: target, moduleSideEffects: false };
      }
      // A Rivet importer (app module, not a framework's own) importing a framework module gets its facade.
      if (!importer || importer.startsWith("\0") || /[/\\]node_modules[/\\]/.test(importer)) return null;
      const from = importer.split("?", 1)[0]!;
      if (!/\.[cm]?[jt]sx?$/.test(from) || owner(from)) return null;
      if (!source.startsWith(".") && !source.startsWith("/") && !source.startsWith("\0")) {
        const entry = specifierOwner(entries, source);
        return entry ? used(facadeId(NPM + source, source, entry), from, source) : null;
      }
      const pair = from + "\0" + source;
      let id = resolved.get(pair);
      if (id === undefined) {
        const hit = await this.resolve(source, importer, { ...options, skipSelf: true });
        const file = hit && !hit.external ? hit.id.split("?", 1)[0]! : "\0";
        const entry = file.startsWith("\0") ? null : owner(file);
        resolved.set(pair, (id = entry ? facadeId(file, keyOf(file), entry) : null));
      }
      return id === null ? null : used(id, from, source);
    },
    async load(id, options) {
      if (id.startsWith(FACADE)) return id.includes("rivet-chunk=") ? null : facadeText(this, id);
      const ssr = server(this, options?.ssr);
      if (id.startsWith(DEF_ID)) {
        const facade = facadeOf(FACADE + id.slice(DEF_ID.length) + ".tsx");
        if (!facade) return null;
        const list = await exportsFor(this, facade);
        return ssr ? serverDefs(targetSpecifier(facade), facade.key, facade.entry.server, list) : clientDefs(facade.key, list);
      }
      if (id.startsWith(CLIENT_ID)) {
        // Never loaded on the server (the server only names the loader): an empty stub keeps the client adapter out.
        if (ssr) return "export default null;\n";
        const [target = "", query = ""] = id.slice(CLIENT_ID.length).split("?", 2);
        const facade = facadeOf(FACADE + target + ".tsx");
        const name = new URLSearchParams(query).get("export");
        if (!facade || !name) return null;
        return islandModule(targetSpecifier(facade), facade.key, name, facade.entry.client, serve);
      }
      return null;
    },
    // Export list changes re-render the facade's importers; other edits are the framework's HMR (or the island module's
    // dev accept: re-hydrate that island).
    async hotUpdate({ file, modules, type }) {
      sources.delete(file);
      if (type !== "update") resolved.clear();
      const facade = byTarget(file);
      if (!facade || !modules.length) return;
      const before = exportCache.get(file);
      const graph = this.environment.moduleGraph;
      const facadeModule = graph.getModuleById(FACADE + file + ".tsx");
      if (!facadeModule) return;
      // Re-read the export list from the edited source file (the list always comes from source, never transformed code).
      let list: IslandExport[];
      try {
        list = await listOf({ resolve: (id, importer) => this.environment.pluginContainer.resolveId(id, importer) as never }, facade, file);
      } catch {
        return;
      }
      if (JSON.stringify(list) === before) return;
      exportCache.set(file, JSON.stringify(list));
      // The definitions module changes with the list too: updated with the facade (the browser re-imports both).
      const defModule = graph.getModuleById(DEF_ID + file);
      return [...modules, ...(defModule ? [defModule] : []), facadeModule];
    },
    generateBundle(_options, bundle) {
      if (serve || this.environment?.config.consumer === "server") return;
      const chunks = Object.values(bundle).filter((o): o is Rollup.OutputChunk => o.type === "chunk");
      const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      // RV2146: a facade's non-component export rendered in the browser bundle (the framework module came with it).
      for (const facade of facades.values()) {
        if (facade.target.startsWith(NPM)) continue;
        const plain = new Set(
          (JSON.parse(exportCache.get(facade.target) ?? "[]") as IslandExport[]).filter((entry) => !entry.component).map((entry) => entry.name),
        );
        if (!plain.size) continue;
        for (const chunk of chunks) {
          const used = (chunk.modules[facade.target]?.renderedExports ?? []).filter((name) => plain.has(name));
          if (!used.length) continue;
          const importers = importersOf(this, facade);
          for (const name of used)
            this.warn(
              `[RV2146] Non-component export ${name} from a ${facade.entry.name} module used in browser code of a Rivet file (${importers.join(", ") || facade.key}): it ships ${facade.key} and its framework runtime in ${chunk.fileName}`,
            );
        }
      }
      // Per-page framework bytes: the island chunks a Rivet module's facades load, with their static closure, brotli.
      const brCache = new Map<string, number>();
      const br = (file: string) => {
        let size = brCache.get(file);
        if (size === undefined) brCache.set(file, (size = brotliCompressSync(Buffer.from(byFile.get(file)?.code ?? "")).length));
        return size;
      };
      const closure = (file: string, into: Set<string>) => {
        if (into.has(file)) return;
        into.add(file);
        for (const next of byFile.get(file)?.imports ?? []) closure(next, into);
      };
      const pages = new Map<string, Map<string, Set<string>>>(); // importer → framework → files
      for (const chunk of chunks) {
        const key = chunk.facadeModuleId ? api.islandKey(chunk.facadeModuleId) : null;
        if (!key) continue;
        const facade = byTarget(chunk.facadeModuleId!.slice(CLIENT_ID.length).split("?", 1)[0]!);
        if (!facade) continue;
        // Resumed-only pages import the facade through symbol chunks alone: reported under the island module.
        const importers = importersOf(this, facade);
        for (const page of importers.length ? importers : [facade.key]) {
          let frameworks = pages.get(page);
          if (!frameworks) pages.set(page, (frameworks = new Map()));
          let files = frameworks.get(facade.entry.name);
          if (!files) frameworks.set(facade.entry.name, (files = new Set()));
          closure(chunk.fileName, files);
        }
      }
      for (const [page, frameworks] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
        const parts = [...frameworks].map(([name, files]) => `${name} ${([...files].reduce((sum, file) => sum + br(file), 0) / 1024).toFixed(1)} KB br`);
        config?.logger.info(`[rivet:bridge] ${page}: ${parts.join(", ")}`);
      }
      // Island chunks no Rivet module imports (resume builds emit one per component export): listed, so an export the
      // detection wrongly took for a component (or a dead one) is visible.
      const emitted = new Set(chunks.map((chunk) => (chunk.facadeModuleId ? api.islandKey(chunk.facadeModuleId) : null)).filter((key) => key !== null));
      const unused: string[] = [];
      for (const [id, facade] of facades) {
        const list = JSON.parse(exportCache.get(facade.target) ?? "[]") as IslandExport[];
        const names = new Set<string>();
        for (const pair of uses.get(id) ?? []) {
          const [file = "", specifier = ""] = pair.split("\0");
          for (const name of importedNames(file, specifier)) names.add(name);
        }
        if (names.has("*")) continue;
        for (const entry of list)
          if (entry.alias !== undefined && names.has(entry.name)) names.add(entry.alias);
          else if (entry.alias !== undefined && names.has(entry.alias)) names.add(entry.name);
        for (const entry of list) {
          const key = facade.key + "#" + entry.name;
          if (entry.component && entry.alias === undefined && emitted.has(key) && !names.has(entry.name)) unused.push(key);
        }
      }
      if (unused.length) config?.logger.info(`[rivet:bridge] unused islands (chunk emitted, no Rivet module imports it): ${unused.sort().join(", ")}`);
    },
  };
}

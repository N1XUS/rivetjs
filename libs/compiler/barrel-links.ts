/**
 * Barrel links (CHUNK-CYCLE 2026-10-20): the modules an importer really uses through a barrel (a pure re-export module,
 * `isBarrel`). The bundler links the importer of `{ ShoppingBag } from "lucide"` straight to
 * `lucide/dist/esm/icons/shopping-bag.mjs` and drops the barrel, so the leaf is placed by the entries of its real
 * importers. The co-load planner (`chunk-groups.ts`) stops its owner walk at large barrels (an entry reaching one would
 * own every module behind it); without these links a leaf used only through a barrel is owned by no entry, stays out of
 * every group and lands in the chunk of its importer's entry — while the importer may sit in a merge group that this
 * entry's chunk imports: a chunk cycle (ui story `/visual/accordion`: `items[i].icon` read before the route chunk
 * defined the icon). With the links the leaf has the owners of its importers and is grouped with them.
 *
 * Resolution is by name: every name an importer imports (named / default, not namespace or type-only) is looked up in
 * each barrel it imports (`export { a as b } from`, `export * from` chains, other barrels followed); a name a barrel
 * declares itself maps to nothing (the barrel module stays the import). A namespace import (`import * as ns`) is left to
 * the barrel stop (unknown use).
 */

/** What the planner input knows about one module (Rolldown `ModuleInfo` subset). */
export interface LinkModule {
  id: string;
  code: string | null;
  importedIds: readonly string[];
  exports: readonly string[];
  barrel: boolean;
}

interface Node {
  type: string;
  [key: string]: unknown;
}

const nameOf = (node: unknown): string | null => {
  const n = node as { type?: string; name?: string; value?: unknown } | null;
  if (!n) return null;
  if (n.type === "Identifier") return n.name ?? null;
  return typeof n.value === "string" ? n.value : null;
};

/**
 * Importer id → the non-barrel modules its barrel imports bind to (sorted, deduplicated). `parse` returns an ESTree
 * program (Vite's `parseAst`); `resolveSpec` resolves a barrel's non-relative re-export specifier (relative ones are
 * matched against the barrel's `importedIds`).
 */
export async function barrelUses(
  modules: ReadonlyMap<string, LinkModule>,
  parse: (code: string) => { body: readonly unknown[] },
  resolveSpec: (spec: string, importer: string) => Promise<string | null>,
): Promise<Map<string, string[]>> {
  const program = (m: LinkModule): readonly Node[] => {
    try {
      return m.code == null ? [] : (parse(m.code).body as Node[]);
    } catch {
      return [];
    }
  };
  const source = async (spec: string, from: LinkModule): Promise<string | null> => {
    if (spec.startsWith(".")) {
      const dir = from.id.split("?")[0]!.replace(/[^/\\]*$/, "");
      const path = normalize(dir + spec);
      const hit = from.importedIds.find((id) => id.split("?")[0] === path || id.split("?")[0]!.replace(/\.[^./\\]+$/, "") === path);
      if (hit) return hit;
    }
    return resolveSpec(spec, from.id).catch(() => null);
  };
  // Barrel id → exported name → modules behind it (empty: declared by the barrel itself). Cycle-safe (`export *` loops).
  const maps = new Map<string, Promise<Map<string, string[]>>>();
  const exportsOf = (id: string): Promise<Map<string, string[]>> => {
    let hit = maps.get(id);
    if (!hit) maps.set(id, (hit = build(id)));
    return hit;
  };
  const inFlight = new Set<string>();
  const build = async (id: string): Promise<Map<string, string[]>> => {
    const out = new Map<string, string[]>();
    const barrel = modules.get(id);
    if (!barrel) return out;
    inFlight.add(id);
    const behind = async (target: string | null, name: string): Promise<string[]> => {
      if (!target) return [];
      const module = modules.get(target);
      if (!module?.barrel) return [target];
      if (inFlight.has(target)) return [];
      return (await exportsOf(target)).get(name) ?? [];
    };
    const stars: (string | null)[] = [];
    for (const node of program(barrel)) {
      if (node.type === "ExportNamedDeclaration") {
        if ((node as { exportKind?: string }).exportKind === "type") continue;
        const from = nameOf(node.source);
        const specifiers = (node.specifiers as Node[] | undefined) ?? [];
        if (from === null) {
          // Own declarations / local `export { a as b }`: the barrel itself.
          for (const s of specifiers) out.set(nameOf(s.exported) ?? "", []);
          const decl = node.declaration as { id?: unknown; declarations?: { id?: unknown }[] } | null;
          if (decl?.id) out.set(nameOf(decl.id) ?? "", []);
          for (const d of decl?.declarations ?? []) out.set(nameOf(d.id) ?? "", []);
          continue;
        }
        const target = await source(from, barrel);
        for (const s of specifiers) {
          const exported = nameOf(s.exported),
            local = nameOf(s.local);
          if (exported !== null && local !== null && !out.has(exported)) out.set(exported, await behind(target, local));
        }
      } else if (node.type === "ExportDefaultDeclaration") out.set("default", []);
      else if (node.type === "ExportAllDeclaration") {
        const from = nameOf(node.source);
        if (from === null) continue;
        const target = await source(from, barrel);
        const as = nameOf(node.exported);
        // `export * as ns from`: the namespace object (every export of the target) — the target module itself.
        if (as !== null) out.set(as, target && !modules.get(target)?.barrel ? [target] : []);
        else stars.push(target);
      }
    }
    // `export *` names never shadow explicit ones (ES semantics: explicit exports win).
    for (const target of stars) {
      if (!target) continue;
      const module = modules.get(target);
      if (!module) continue;
      if (!module.barrel) {
        for (const name of module.exports) if (name !== "default" && !out.has(name)) out.set(name, [target]);
      } else if (!inFlight.has(target)) for (const [name, leaves] of await exportsOf(target)) if (name !== "default" && !out.has(name)) out.set(name, leaves);
    }
    inFlight.delete(id);
    return out;
  };
  const uses = new Map<string, string[]>();
  for (const module of modules.values()) {
    if (module.barrel || module.code == null) continue;
    const barrels = module.importedIds.filter((id) => modules.get(id)?.barrel);
    if (!barrels.length) continue;
    const names = new Set<string>();
    for (const node of program(module)) {
      if (node.type === "ImportDeclaration") {
        if ((node as { importKind?: string }).importKind === "type") continue;
        for (const s of (node.specifiers as Node[] | undefined) ?? []) {
          if ((s as { importKind?: string }).importKind === "type") continue;
          if (s.type === "ImportSpecifier") names.add(nameOf(s.imported) ?? "");
          else if (s.type === "ImportDefaultSpecifier") names.add("default");
        }
      } else if (node.type === "ExportNamedDeclaration" && node.source)
        for (const s of (node.specifiers as Node[] | undefined) ?? []) names.add(nameOf(s.local) ?? "");
    }
    const out = new Set<string>();
    for (const barrel of barrels) {
      const map = await exportsOf(barrel);
      for (const name of names) for (const leaf of map.get(name) ?? []) if (leaf !== module.id) out.add(leaf);
    }
    if (out.size) uses.set(module.id, [...out].sort());
  }
  return uses;
}

/** `a/b/../c/./d` → `a/c/d` (POSIX and Windows separators). */
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split(/[/\\]/)) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

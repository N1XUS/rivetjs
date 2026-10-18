/**
 * Co-load chunk groups (PRELOAD-GROUP 2026-10-12): merge the modules the bundler would split into one chunk per
 * distinct set of entries that import them (Rolldown / Rollup automatic splitting) into fewer chunks, when the bytes
 * that merging makes some entries load without needing them stay small per request saved.
 *
 * Start: one group per owner set (the automatic split: no entry loads a byte it does not use). Then greedily merge the
 * cheapest pair of groups adjacent in the import graph. `both` = entries that load both groups (each saves one
 * request); an entry needing only A loads B's bytes extra, plus what B imports (groups and ungrouped modules, one
 * level) that it did not load yet. A merge is taken when
 * - the extra bytes of all entries / `both` stay within the budget. The budget is AMORTISED over entries and checked
 *   per merge step: one entry can pay several budgets when it shares a hub with many others (ui-docs: preload closure
 *   bytes p90 +7 %, max +27 %; full state max +64 %). A cumulative per-entry cap was measured and dropped: at 1×
 *   budget the preload median went 77 → 76 files instead of 77 → 50 (max +8.8 %), at 16× 77 → 65 (full state max
 *   still +64 %: the worst tails come from tree-shaking the static walk cannot see, below);
 * - the groups agree on every pinned (always loaded) owner;
 * - the merged chunk would not form an import cycle with a chunk outside it (a path A → X → B through any other
 *   group or ungrouped module — a dynamic-import target, a virtual module, an entry — would make B's chunk and X's
 *   import each other: evaluation order breaks, TDZ errors).
 * Groups merge only along import edges, so a merged chunk stays a connected piece of the module graph. Only merged
 * groups of several owners get a name: an unmerged owner set is the bundler's own chunk, a single-owner group belongs
 * in its entry's chunk. Input order does not matter: modules are sorted by id first (names are stable).
 *
 * `cap` (ROUTE-CHUNKS placed parts, 2026-10-18): after the budget pass, an entry that still loads more than `cap`
 * groups keeps merging the cheapest pair of its groups, adjacent or not (the budget no longer limits; pinned owners and
 * cycles still do), until it loads `cap` or no pair of its groups can merge. Pinned entries (every page loads them) are
 * skipped: their owner sets over-count through barrels, and a cap there would fold page code into one chunk every page
 * downloads. A merge never raises another entry's count, so one pass over the entries settles every one.
 */

/** One module of the graph: size in bytes, static imports (ids), whether it may be grouped. */
export interface CoLoadModule {
  id: string;
  size: number;
  imports: readonly string[];
  /**
   * Loads on its own: a static entry, or the target of a dynamic import (lazy route, island, library `import()`).
   * Entries own the modules their static import closure reaches; they are never grouped.
   */
  entry: boolean;
  groupable: boolean;
  /**
   * A pure re-export module (barrel): the bundler links its importers to the re-exported modules they use, so an owner
   * reaching it does not own everything behind it. The owner walk stops there (an entry using a module only through a
   * barrel is not counted as its owner: a small under-count, never a split). What a pinned entry reaches only through
   * a barrel is never grouped (it may be loaded on every page).
   */
  barrel?: boolean;
  /**
   * An entry every page loads (the resume runtime, the app entry): groups merge only when they agree on every pinned
   * owner, so nothing joins the always-loaded chunks and they never pull page code in.
   */
  pinned?: boolean;
}

export interface CoLoadOptions {
  /** Extra bytes accepted per request saved (summed over entries, per merge step: amortised). Default 2048. */
  budget?: number;
  /** Most groups one entry (not a pinned one) loads after merging; unset = the budget alone decides. */
  cap?: number;
}

/** Prefix of every group name (Rolldown merges groups of one name: never collide with the user's own groups). */
export const MERGE_PREFIX = "rivet-merge-";

/** Module id → group name for every grouped module (modules left out keep the bundler's automatic chunking). */
export function coLoadGroups(input: readonly CoLoadModule[], options: CoLoadOptions = {}): Map<string, string> {
  const budget = options.budget ?? 2048;
  // Sorted by id: group order, tie-breaks and name suffixes never depend on the bundler's module order.
  const modules = [...input].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const index = new Map<string, number>();
  modules.forEach((m, i) => index.set(m.id, i));
  const imports = modules.map((m) => m.imports.map((id) => index.get(id)).filter((i): i is number => i !== undefined));
  const entries = modules.flatMap((m, i) => (m.entry ? [i] : []));
  const words = (entries.length + 31) >>> 5;
  // Owners of every reached module: entries whose static import closure (through other entries too: importing an
  // entry loads its imports) reaches it, the walk stopping at barrels. Known over-count: the bundler drops unused
  // side-effect-free modules (a package index importing every state module), so an entry may own on paper what it never
  // loads, and a merge can then make it load that group for real (the worst pages above: color swatch picker → color
  // area / wheel state).
  const ownersOf: (Uint32Array | undefined)[] = new Array(modules.length);
  const seen = new Int32Array(modules.length).fill(-1);
  const walk = (entry: number, e: number, through: boolean, visit: (m: number) => void) => {
    const stack = [entry];
    while (stack.length) {
      const m = stack.pop()!;
      if (seen[m] === e) continue;
      seen[m] = e;
      visit(m);
      if (modules[m]!.barrel && m !== entry && !through) continue;
      for (const next of imports[m]!) if (seen[next] !== e) stack.push(next);
    }
  };
  // Modules a pinned entry may load through a barrel (the barrel stop cannot tell which it uses): never grouped, so
  // an always-loaded chunk never pulls page code in through a group it might share with them.
  const frozen = new Uint8Array(modules.length);
  entries.forEach((entry, e) => {
    walk(entry, e, false, (m) => {
      const set = (ownersOf[m] ??= new Uint32Array(words));
      set[e >>> 5]! |= 1 << (e & 31);
    });
    if (!modules[entry]!.pinned) return;
    seen.fill(-1);
    walk(entry, e, true, (m) => {
      if (!((ownersOf[m]?.[e >>> 5] ?? 0) & (1 << (e & 31)))) frozen[m] = 1;
    });
  });
  // Initial groups: one per owner set (module index order).
  interface Group {
    owners: Uint32Array;
    count: number;
    bytes: number;
    members: number[];
    alive: boolean;
    /** Owner sets merged into this group (1 = the bundler's own chunk for that set). */
    sets: number;
  }
  const groups: Group[] = [];
  const groupOf = new Int32Array(modules.length).fill(-1);
  const bySet = new Map<string, number>();
  modules.forEach((module, m) => {
    const set = ownersOf[m];
    if (!module.groupable || !set || frozen[m]) return;
    const key = Array.prototype.join.call(set, ",");
    let g = bySet.get(key);
    if (g === undefined) {
      bySet.set(key, (g = groups.length));
      groups.push({ owners: set.slice(), count: popcount(set), bytes: 0, members: [], alive: true, sets: 1 });
    }
    groups[g]!.bytes += module.size;
    groups[g]!.members.push(m);
    groupOf[m] = g;
  });
  // What a group's members import outside it: other groups, and ungrouped modules (entries, dynamic-import targets,
  // virtual modules) that load with it.
  const neighbours = (g: number): { groups: number[]; modules: number[] } => {
    const out = new Set<number>(),
      loose = new Set<number>();
    for (const m of groups[g]!.members)
      for (const next of imports[m]!) {
        const h = groupOf[next]!;
        if (h < 0) loose.add(next);
        else if (h !== g) out.add(h);
      }
    return { groups: [...out], modules: [...loose] };
  };
  // Importers too: adjacency is symmetric.
  const importers = modules.map(() => [] as number[]);
  imports.forEach((list, m) => {
    for (const next of list) importers[next]!.push(m);
  });
  const adjacent = (g: number): Set<number> => {
    const out = new Set(neighbours(g).groups);
    for (const m of groups[g]!.members)
      for (const prev of importers[m]!) {
        const h = groupOf[prev]!;
        if (h >= 0 && h !== g) out.add(h);
      }
    return out;
  };
  const pinned = new Uint32Array(words);
  entries.forEach((entry, e) => {
    if (modules[entry]!.pinned) pinned[e >>> 5]! |= 1 << (e & 31);
  });
  const version = new Int32Array(groups.length);
  // Imports of a group (cached per group version): an entry that newly loads a merged group also loads them.
  const importCache = new Map<number, { version: number; list: { groups: number[]; modules: number[] } }>();
  const importsOf = (g: number) => {
    const hit = importCache.get(g);
    // Stale when g changed or a group it imports merged into another one.
    if (hit && hit.version === version[g] && hit.list.groups.every((h) => groups[h]!.alive)) return hit.list;
    const list = neighbours(g);
    importCache.set(g, { version: version[g]!, list });
    return list;
  };
  // Bytes the owners of `from` that are not owners of `to` load extra once `to` joins them: `to` itself plus what `to`
  // imports (groups and ungrouped modules) that they do not load yet (one import level; deeper levels are mostly owned
  // already).
  const extra = (from: Group, to: number, skip: number): number => {
    const target = groups[to]!;
    let n = 0;
    for (let w = 0; w < words; w++) n += popcount1(from.owners[w]! & ~target.owners[w]!);
    if (n === 0) return 0;
    let bytes = n * target.bytes;
    const deps = importsOf(to);
    for (const h of deps.groups) {
      if (h === skip) continue;
      const imported = groups[h]!.owners;
      let m = 0;
      for (let w = 0; w < words; w++) m += popcount1(from.owners[w]! & ~target.owners[w]! & ~imported[w]!);
      bytes += m * groups[h]!.bytes;
    }
    for (const x of deps.modules) {
      const loaded = ownersOf[x];
      let m = 0;
      for (let w = 0; w < words; w++) m += popcount1(from.owners[w]! & ~target.owners[w]! & ~(loaded ? loaded[w]! : 0));
      bytes += m * modules[x]!.size;
    }
    return bytes;
  };
  const cost = (a: number, b: number): number => {
    const A = groups[a]!,
      B = groups[b]!;
    for (let w = 0; w < words; w++) if ((A.owners[w]! ^ B.owners[w]!) & pinned[w]!) return Infinity;
    let both = 0;
    for (let w = 0; w < words; w++) both += popcount1(A.owners[w]! & B.owners[w]!);
    if (both === 0) return Infinity;
    return (extra(A, b, a) + extra(B, a, b)) / both;
  };
  // Whether a member of `x` reaches a member of `y` through anything outside both (other groups as one node each —
  // one chunk — ungrouped modules on their own). Direct x → y edges are fine: they end up inside the merged chunk.
  const stamp = new Int32Array(groups.length + modules.length);
  let generation = 0;
  const reaches = (x: number, y: number): boolean => {
    generation++;
    const stack: number[] = [];
    const step = (next: number): boolean => {
      const h = groupOf[next]!;
      if (h === y) return true;
      if (h === x) return false;
      const node = h >= 0 ? h : groups.length + next;
      if (stamp[node] !== generation) {
        stamp[node] = generation;
        stack.push(node);
      }
      return false;
    };
    for (const m of groups[x]!.members) for (const next of imports[m]!) if (groupOf[next] !== y && step(next)) return true;
    while (stack.length) {
      const node = stack.pop()!;
      if (node < groups.length) {
        for (const m of groups[node]!.members) for (const next of imports[m]!) if (step(next)) return true;
      } else for (const next of imports[node - groups.length]!) if (step(next)) return true;
    }
    return false;
  };
  // Greedy merging over a binary heap of candidate pairs (stale entries skipped by version, costs re-checked on pop:
  // other merges change what groups import).
  const heap = new PairHeap();
  const offer = (g: number) => {
    for (const h of adjacent(g)) {
      const c = cost(g, h);
      if (c <= budget) heap.push(c, g, h, version[g]!, version[h]!);
    }
  };
  const merge = (a: number, b: number) => {
    const A = groups[a]!,
      B = groups[b]!;
    for (let w = 0; w < words; w++) A.owners[w]! |= B.owners[w]!;
    A.count = popcount(A.owners);
    A.bytes += B.bytes;
    A.sets += B.sets;
    for (const m of B.members) (A.members.push(m), (groupOf[m] = a));
    B.members = [];
    B.alive = false;
    version[a]!++;
  };
  for (let g = 0; g < groups.length; g++) offer(g);
  for (let top; (top = heap.pop());) {
    const [popped, a, b, va, vb] = top;
    if (!groups[a]!.alive || !groups[b]!.alive || version[a] !== va || version[b] !== vb) continue;
    const c = cost(a, b);
    if (c > budget) continue;
    if (c > popped) {
      heap.push(c, a, b, va, vb);
      continue;
    }
    if (reaches(a, b) || reaches(b, a)) continue;
    merge(a, b);
    offer(a);
  }
  // Cap pass: every unpinned entry over the cap merges the cheapest pair of its groups until it holds or nothing merges.
  if (options.cap !== undefined) {
    const owns = (e: number) => groups.flatMap((group, g) => (group.alive && group.owners[e >>> 5]! & (1 << (e & 31)) ? [g] : []));
    for (let e = 0; e < entries.length; e++)
      if (!modules[entries[e]!]!.pinned)
        for (let list = owns(e); list.length > options.cap; list = owns(e)) {
          let best: [number, number] | null = null,
            least = Infinity;
          for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length; j++) {
              const c = cost(list[i]!, list[j]!);
              if (c < least && !reaches(list[i]!, list[j]!) && !reaches(list[j]!, list[i]!)) ((least = c), (best = [list[i]!, list[j]!]));
            }
          if (!best) break;
          merge(best[0], best[1]);
        }
  }
  // Names: prefix + the group's largest module + a counter (the bundler merges groups of one name into one chunk).
  // Only merged groups get one: an unmerged owner set is the bundler's own chunk already, and a group of a single owner
  // is part of that entry's chunk (naming it would split it off into an extra request).
  const names = new Map<string, string>();
  const used = new Map<string, number>();
  for (const group of groups) {
    if (!group.alive || group.sets < 2 || group.count < 2) continue;
    let largest = group.members[0]!;
    for (const m of group.members) if (modules[m]!.size > modules[largest]!.size) largest = m;
    const base = (modules[largest]!.id.split("?")[0]!.split("/").pop() ?? "group").replace(/\.[^.]*$/, "").replace(/[^\w-]/g, "_") || "group";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    for (const m of group.members) names.set(modules[m]!.id, MERGE_PREFIX + (n ? base + "-" + n : base));
  }
  return names;
}

/**
 * Rolldown output options with the merge group appended after the user's own `codeSplitting.groups`, or `undefined`
 * when the user's options rule merging out: `codeSplitting: false`, `manualChunks`, or `advancedChunks` (Rolldown
 * ignores `advancedChunks` once `codeSplitting` is set, so adding ours would silently drop the user's).
 */
export function withMergeGroup<T extends object>(options: T, name: (id: string) => string | null): T | undefined {
  const o = options as { codeSplitting?: unknown; manualChunks?: unknown; advancedChunks?: unknown };
  if (o.codeSplitting === false || o.manualChunks || o.advancedChunks) return undefined;
  const own = typeof o.codeSplitting === "object" && o.codeSplitting ? (o.codeSplitting as { groups?: unknown[] }) : {};
  return {
    ...options,
    codeSplitting: { ...own, groups: [...(own.groups ?? []), { name, debugName: "rivet-merge", includeDependenciesRecursively: false }] },
  };
}

function popcount1(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function popcount(set: Uint32Array): number {
  let n = 0;
  for (let w = 0; w < set.length; w++) n += popcount1(set[w]!);
  return n;
}

type Pair = [cost: number, a: number, b: number, va: number, vb: number];

class PairHeap {
  private items: Pair[] = [];
  push(cost: number, a: number, b: number, va: number, vb: number): void {
    const items = this.items;
    items.push([cost, a, b, va, vb]);
    for (let i = items.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (less(items[p]!, items[i]!)) break;
      [items[p], items[i]] = [items[i]!, items[p]!];
      i = p;
    }
  }
  pop(): Pair | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < items.length && less(items[l]!, items[m]!)) m = l;
        if (r < items.length && less(items[r]!, items[m]!)) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i]!, items[m]!];
        i = m;
      }
    }
    return top;
  }
}

// Ties break by group indexes so the result does not depend on heap insertion order.
const less = (x: Pair, y: Pair) => x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2])));

/** Whether module code is only `import` / `export … from` / `export { … }` statements (a barrel). */
export function isBarrel(code: string): boolean {
  const rest = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .replace(/\b(?:import|export)\b[^;"'`]*?\bfrom\s*(["'])[^"'\n]*\1\s*;?/g, "")
    .replace(/\bimport\s*(["'])[^"'\n]*\1\s*;?/g, "")
    .replace(/\bexport\s*(?:type\s*)?\{[^}]*\}\s*;?/g, "");
  if (/^[\s;]*$/.test(rest) && /\bexport\b/.test(code)) return true;
  // Mostly re-exports (a package index with a little code of its own, e.g. lucide's): at least 8 `export … from`
  // statements making up most of the text.
  const reexports = code.match(/\bexport\b[^;"'`]*?\bfrom\s*(["'])[^"'\n]*\1/g);
  return !!reexports && reexports.length >= 8 && reexports.join("").length > 0.6 * code.length;
}

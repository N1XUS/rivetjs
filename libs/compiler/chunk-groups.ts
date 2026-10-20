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
 * Two passes beyond import adjacency (ROUTE-CHUNKS placed parts, 2026-10-18, ui-docs select frame: 17 of 35 files were
 * 0.1–2 KB chunks): the owner walk goes through SMALL barrels (≤ `SMALL_BARREL` imports: a component's own `index.ts`
 * re-exporting its files — stopping there left every `*.styles.ts` / `.css` pair unowned, hence ungrouped, one request
 * each), and after the budget pass a HUB pass merges groups loaded by at least a quarter of the owners of the
 * most-shared group with each other (widely shared helpers are not import-adjacent; sharing most owners makes their
 * merge cost per request tiny; relative, since entries also count module-reference chunks and lazy targets), under the
 * same budget and guards.
 *
 * `cap` (ROUTE-CHUNKS placed parts, 2026-10-18): after the budget pass, an entry that still loads more than `cap`
 * groups keeps merging the cheapest pair of its groups, adjacent or not (the budget no longer limits; pinned owners and
 * cycles still do), until it loads `cap` or no pair of its groups can merge. Pinned entries (every page loads them) are
 * skipped: their owner sets over-count through barrels, and a cap there would fold page code into one chunk every page
 * downloads. A merge never raises another entry's count, so one pass over the entries settles every one.
 *
 * Strict entries (`strict`, DOCS-JS 2026-10-20): like pinned ones for the owner agreement only — two groups merge only
 * when every strict entry owns both or neither; their owner walk does not enter `late` modules.
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
   * Modules this module's imports bind to through barrels (`barrel-links.ts`, CHUNK-CYCLE 2026-10-20): the bundler links
   * the importer straight to them. Import edges here for the ones the barrel-stopped owner walk leaves unowned (a lucide
   * icon named only through the `lucide` index): they get their importers' owners and group with them instead of
   * landing, ungrouped, in an entry chunk that imports the importer's merge chunk back (a chunk cycle). Modules some
   * entry owns already keep their owner sets.
   */
  uses?: readonly string[];
  /**
   * An entry every page loads (the resume runtime, the app entry): groups merge only when they agree on every pinned
   * owner, so nothing joins the always-loaded chunks and they never pull page code in.
   */
  pinned?: boolean;
  /**
   * An entry that never loads bytes of a group it does not own (DOCS-JS 2026-10-20: a route chunk with an intent sibling,
   * `route:<key>:intent`): groups merge only when they agree on it, so merging never pulls the intent chunk's modules
   * back into the eager chunk's closure. Unlike `pinned`, its groups still merge with each other and the cap still applies.
   */
  strict?: boolean;
  /**
   * A module of an intent-class file (its source module or part, DOCS-JS): strict entries do not walk into it. A strict
   * entry reaches such modules only through static imports the bundler tree-shakes (a frame renders its menus on the
   * server; the browser shell never calls them), so counting it as their owner would let their whole library merge
   * into the shell's closure (cdk-docs: a 112 KB cdk group through the preload helper).
   */
  late?: boolean;
}

export interface CoLoadOptions {
  /**
   * Extra bytes accepted per request saved (summed over entries, per merge step: amortised). Unset = `UNIT_BUDGET`
   * (2048), the unit tests' scale; the Vite plugin always passes `resume.merge`, whose default is `MERGE_BUDGET`.
   */
  budget?: number;
  /** Most groups one entry (not a pinned one) loads after merging; unset = the budget alone decides. */
  cap?: number;
}

/**
 * Default `resume.merge` of the Vite plugin (`vite.ts`; 2048 until 2026-10-18: 64 K cut the files of a page by a third
 * to a half at flat bytes on the ui-docs frames). Not this module's unset default: `coLoadGroups` without a budget uses
 * `UNIT_BUDGET`.
 */
export const MERGE_BUDGET = 65536;
/** Budget when `options.budget` is unset: the scale of the unit-test graphs (tens of bytes to tens of KB per module). */
const UNIT_BUDGET = 2048;
/** Prefix of every group name (Rolldown merges groups of one name: never collide with the user's own groups). */
export const MERGE_PREFIX = "rivet-merge-";
/** A barrel with at most this many imports is a module split in files (a component's `index.ts`): the owner walk goes through it. */
const SMALL_BARREL = 4;
/** Groups loaded by at least this share of the owners of the most-shared group (and ≥ 2) are hubs: they may merge with each other without an import edge. */
const HUB_SHARE = 0.25;

/** Module id → group name for every grouped module (modules left out keep the bundler's automatic chunking). */
export function coLoadGroups(input: readonly CoLoadModule[], options: CoLoadOptions = {}): Map<string, string> {
  return coLoad(input, options).names;
}

/** What `coLoadGroups` decided per module, for the offline replay (`spikes/merge-replay.ts`). */
export interface CoLoadInspection {
  names: Map<string, string>;
  /** Module id → why it is not in a named group: never groupable, frozen (a pinned entry may load it through a barrel),
   * owned by no entry, or in a group of one owner set (the bundler's own chunk) / one owner. */
  reason: Map<string, "ungroupable" | "frozen" | "unowned" | "own-chunk" | "single-owner" | "grouped">;
  /** Module id → owners the walk found (entries), and how many of them are pinned. */
  owners: Map<string, { count: number; pinned: number }>;
}

export function coLoadInspect(input: readonly CoLoadModule[], options: CoLoadOptions = {}): CoLoadInspection {
  return coLoad(input, options);
}

function coLoad(input: readonly CoLoadModule[], options: CoLoadOptions): CoLoadInspection {
  const budget = options.budget ?? UNIT_BUDGET;
  // Sorted by id: group order, tie-breaks and name suffixes never depend on the bundler's module order.
  const modules = [...input].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const index = new Map<string, number>();
  modules.forEach((m, i) => index.set(m.id, i));
  const ids = (list: readonly string[] | undefined) => (list ?? []).map((id) => index.get(id)).filter((i): i is number => i !== undefined);
  let imports = modules.map((m) => ids(m.imports));
  const entries = modules.flatMap((m, i) => (m.entry ? [i] : []));
  // Barrel links (`uses`): an edge only into a module the barrel-stopped walk leaves unowned (what it owns keeps its
  // owner set — widening those moved hub merges: the ui-docs router chunk pulled in the 296 KB example-frames table).
  const linked = modules.map((m) => ids(m.uses));
  if (linked.some((list) => list.length)) {
    const owned = new Uint8Array(modules.length);
    for (const strict of [false, true]) {
      const stack = entries.filter((e) => !!modules[e]!.strict === strict);
      const seen = new Uint8Array(modules.length);
      const roots = new Set(stack);
      while (stack.length) {
        const m = stack.pop()!;
        if (seen[m]) continue;
        seen[m] = owned[m] = 1;
        if (modules[m]!.barrel && !roots.has(m) && imports[m]!.length > SMALL_BARREL) continue;
        for (const next of imports[m]!) if (!seen[next] && !(strict && modules[next]!.late)) stack.push(next);
      }
    }
    imports = imports.map((list, m) => (linked[m]!.some((t) => !owned[t]) ? [...new Set([...list, ...linked[m]!.filter((t) => !owned[t])])] : list));
  }
  const words = (entries.length + 31) >>> 5;
  // Owners of every reached module: entries whose static import closure (through other entries too: importing an
  // entry loads its imports) reaches it, the walk stopping at barrels. Known over-count: the bundler drops unused
  // side-effect-free modules (a package index importing every state module), so an entry may own on paper what it never
  // loads, and a merge can then make it load that group for real (the worst pages above: color swatch picker → color
  // area / wheel state).
  const ownersOf: (Uint32Array | undefined)[] = new Array(modules.length);
  const seen = new Int32Array(modules.length).fill(-1);
  const walk = (entry: number, e: number, through: boolean, visit: (m: number) => void) => {
    const stack = [entry],
      strict = !!modules[entry]!.strict;
    while (stack.length) {
      const m = stack.pop()!;
      if (seen[m] === e) continue;
      seen[m] = e;
      visit(m);
      if (modules[m]!.barrel && m !== entry && !through && imports[m]!.length > SMALL_BARREL) continue;
      for (const next of imports[m]!) if (seen[next] !== e && !(strict && modules[next]!.late)) stack.push(next);
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
  const pinned = new Uint32Array(words),
    agree = new Uint32Array(words);
  entries.forEach((entry, e) => {
    if (modules[entry]!.pinned) pinned[e >>> 5]! |= 1 << (e & 31);
    if (modules[entry]!.pinned || modules[entry]!.strict) agree[e >>> 5]! |= 1 << (e & 31);
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
    for (let w = 0; w < words; w++) if ((A.owners[w]! ^ B.owners[w]!) & agree[w]!) return Infinity;
    let both = 0;
    for (let w = 0; w < words; w++) both += popcount1(A.owners[w]! & B.owners[w]!);
    if (both === 0) return Infinity;
    return (extra(A, b, a) + extra(B, a, b)) / both;
  };
  // Whether a member of `x` reaches a member of `y` through anything outside both. Direct x → y edges are fine: they end
  // up inside the merged chunk. Nodes are the chunks the bundler will emit (CHUNK-CYCLE 2026-10-20): a named group (of
  // several owner sets) is one chunk; every other module — an entry, an ungroupable or frozen module, a group still of one
  // owner set — sits in the bundler's chunk of its owner set (an entry's chunk holds what only that entry owns), so all
  // modules of one owner set are one node; an unowned module is a node of its own. Before, ungrouped modules were nodes
  // on their own: a member importing a module that only one entry owns (a `?url` / virtual module) missed that the
  // module is part of the entry chunk that imports the merged chunk back.
  const setKey = new Int32Array(modules.length).fill(-1);
  const setMembers: number[][] = [];
  {
    const ids = new Map<string, number>();
    modules.forEach((_, m) => {
      const set = ownersOf[m];
      if (!set) return;
      const key = Array.prototype.join.call(set, ",");
      let k = ids.get(key);
      if (k === undefined) (ids.set(key, (k = setMembers.length)), setMembers.push([]));
      setKey[m] = k;
      setMembers[k]!.push(m);
    });
  }
  const named = (g: number) => groups[g]!.sets >= 2 && groups[g]!.count >= 2;
  const stamp = new Int32Array(groups.length + modules.length + setMembers.length);
  let generation = 0;
  const reaches = (x: number, y: number): boolean => {
    generation++;
    const stack: number[] = [];
    const step = (next: number): boolean => {
      const h = groupOf[next]!;
      if (h === y) return true;
      if (h === x) return false;
      const node = h >= 0 && named(h) ? h : setKey[next]! >= 0 ? groups.length + modules.length + setKey[next]! : groups.length + next;
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
      } else if (node < groups.length + modules.length) {
        for (const next of imports[node - groups.length]!) if (step(next)) return true;
      } else
        for (const m of setMembers[node - groups.length - modules.length]!) {
          const h = groupOf[m]!;
          // Members that left the owner set's chunk: x / y (the merge under test) and named groups (nodes of their own).
          if (h === x || h === y || (h >= 0 && named(h))) continue;
          for (const next of imports[m]!) if (step(next)) return true;
        }
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
  // Hub pass: groups most entries load merge with each other (not import-adjacent: never offered above), cheapest first.
  for (;;) {
    const most = Math.max(0, ...groups.map((group) => (group.alive ? group.count : 0)));
    const hubs = groups.flatMap((group, g) => (group.alive && group.count >= Math.max(2, most * HUB_SHARE) ? [g] : []));
    let best: [number, number] | null = null,
      least = Infinity;
    for (let i = 0; i < hubs.length; i++)
      for (let j = i + 1; j < hubs.length; j++) {
        const c = cost(hubs[i]!, hubs[j]!);
        if (c < least && c <= budget && !reaches(hubs[i]!, hubs[j]!) && !reaches(hubs[j]!, hubs[i]!)) ((least = c), (best = [hubs[i]!, hubs[j]!]));
      }
    if (!best) break;
    merge(best[0], best[1]);
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
  const reason: CoLoadInspection["reason"] = new Map();
  const ownerInfo: CoLoadInspection["owners"] = new Map();
  modules.forEach((module, m) => {
    const set = ownersOf[m];
    let pinnedOwners = 0;
    if (set) for (let w = 0; w < words; w++) pinnedOwners += popcount1(set[w]! & pinned[w]!);
    ownerInfo.set(module.id, { count: set ? popcount(set) : 0, pinned: pinnedOwners });
    const g = groupOf[m]!;
    reason.set(
      module.id,
      !module.groupable
        ? "ungroupable"
        : frozen[m]
          ? "frozen"
          : !set
            ? "unowned"
            : g < 0
              ? "unowned"
              : groups[g]!.count < 2
                ? "single-owner"
                : groups[g]!.sets < 2
                  ? "own-chunk"
                  : "grouped",
    );
  });
  for (const group of groups) {
    if (!group.alive || group.sets < 2 || group.count < 2) continue;
    let largest = group.members[0]!;
    for (const m of group.members) if (modules[m]!.size > modules[largest]!.size) largest = m;
    const base = (modules[largest]!.id.split("?")[0]!.split("/").pop() ?? "group").replace(/\.[^.]*$/, "").replace(/[^\w-]/g, "_") || "group";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    for (const m of group.members) names.set(modules[m]!.id, MERGE_PREFIX + (n ? base + "-" + n : base));
  }
  return { names, reason, owners: ownerInfo };
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

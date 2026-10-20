import { test } from "vitest";
import assert from "node:assert/strict";
import { coLoadGroups, coLoadInspect, isBarrel, MERGE_PREFIX, withMergeGroup, type CoLoadModule } from "../chunk-groups.ts";

const mod = (id: string, size: number, imports: string[] = [], extra: Partial<CoLoadModule> = {}): CoLoadModule => ({
  id,
  size,
  imports,
  entry: false,
  groupable: true,
  ...extra,
});
const entry = (id: string, imports: string[], extra: Partial<CoLoadModule> = {}) => mod(id, 10, imports, { entry: true, groupable: false, ...extra });

test("modules used by the same entries share a group; a small module loaded by fewer entries merges in", () => {
  // a: x → y; b: y, z → y. Bundler split: x {a}, y {a,b}, z {b}.
  const graph = [entry("a", ["/s/x.ts"]), entry("b", ["/s/z.ts"]), mod("/s/x.ts", 100, ["/s/y.ts"]), mod("/s/y.ts", 5000), mod("/s/z.ts", 200, ["/s/y.ts"])];
  const groups = coLoadGroups(graph);
  assert.ok(groups.get("/s/y.ts"));
  assert.equal(new Set([groups.get("/s/x.ts"), groups.get("/s/y.ts"), groups.get("/s/z.ts")]).size, 1);
  // Budget 0: only modules of one owner set group; three owner sets of one module each → nothing named.
  assert.equal(coLoadGroups(graph, { budget: 0 }).size, 0);
});

test("a large module used by fewer entries stays apart (extra bytes per request saved over budget)", () => {
  const graph = [entry("a", ["/s/x.ts"]), entry("b", ["/s/y.ts"]), mod("/s/x.ts", 50_000, ["/s/y.ts"]), mod("/s/y.ts", 300)];
  const groups = coLoadGroups(graph);
  assert.equal(groups.get("/s/x.ts"), undefined);
  assert.equal(groups.get("/s/y.ts"), undefined);
  const loose = coLoadGroups(graph, { budget: 100_000 });
  assert.ok(loose.get("/s/x.ts"));
  assert.equal(loose.get("/s/x.ts"), loose.get("/s/y.ts"));
});

test("the cost counts what the merged group imports: an entry that newly loads it loads its imports too", () => {
  // s uses nav only; p's group (1000 B) imports nav and a 40 KB library chunk shared with q. Merging nav into the group
  // looks cheap (s loads 1000 B more) but s would load the library as well.
  const graph = [
    entry("s", ["/s/nav.ts"]),
    entry("p", ["/s/group.ts"]),
    entry("q", ["/s/big.ts"]),
    mod("/s/nav.ts", 100),
    mod("/s/group.ts", 1000, ["/s/nav.ts", "/s/big.ts"]),
    mod("/s/big.ts", 40_000),
  ];
  const groups = coLoadGroups(graph);
  assert.equal(groups.get("/s/nav.ts"), undefined);
  // Without the library import the merge is within budget.
  const light = graph.map((m) => (m.id === "/s/group.ts" ? { ...m, imports: ["/s/nav.ts"] } : m));
  assert.ok(coLoadGroups(light).get("/s/nav.ts"));
  assert.equal(coLoadGroups(light).get("/s/nav.ts"), coLoadGroups(light).get("/s/group.ts"));
});

test("groups merge only along import edges (below the hub share)", () => {
  // x {a} and z {a,b} are not adjacent: no merge even with a huge budget. Six entries: neither is a hub.
  const graph = [
    entry("a", ["/s/x.ts", "/s/z.ts"]),
    entry("b", ["/s/z.ts"]),
    ...["c", "d", "e", "f"].map((n) => entry(n, [])),
    mod("/s/x.ts", 10),
    mod("/s/z.ts", 10),
  ];
  assert.equal(coLoadGroups(graph, { budget: 1e9 }).size, 0);
});

test("strict entries (an eager shell chunk with an intent sibling) never take intent-only code; late modules stop their walk", () => {
  // shell → helper ← intent → lib; helper {shell, intent}, lib {intent}: adjacent and tiny, merged under any budget.
  const graph = [
    entry("shell", ["/s/helper.ts"]),
    entry("intent", ["/s/helper.ts", "/s/lib.ts"]),
    mod("/s/helper.ts", 10),
    mod("/s/lib.ts", 10, ["/s/helper.ts"]),
  ];
  const loose = coLoadGroups(graph, { budget: 1e9 });
  assert.ok(loose.get("/s/lib.ts"));
  assert.equal(loose.get("/s/lib.ts"), loose.get("/s/helper.ts"));
  const strict = graph.map((m) => (m.id === "shell" ? { ...m, strict: true } : m));
  assert.equal(coLoadGroups(strict, { budget: 1e9 }).get("/s/lib.ts"), undefined);
  // The shell reaching lib only through a late module (a frame source module whose menu the bundler tree-shakes out of
  // the shell): not its owner, so lib still stays out of the helper's group; without `late` the walk owns lib too.
  const through = [
    entry("shell", ["/s/helper.ts", "/s/frame.tsx"], { strict: true }),
    entry("intent", ["/s/frame.tsx", "/s/lib.ts"]),
    mod("/s/frame.tsx", 10, ["/s/lib.ts", "/s/helper.ts"], { late: true }),
    mod("/s/helper.ts", 10),
    mod("/s/lib.ts", 10, ["/s/helper.ts"]),
  ];
  assert.equal(coLoadInspect(through, { budget: 1e9 }).owners.get("/s/lib.ts")!.count, 1);
  assert.equal(coLoadGroups(through, { budget: 1e9 }).get("/s/lib.ts"), undefined);
  assert.equal(
    coLoadInspect(
      through.map((m) => ({ ...m, late: false })),
      { budget: 1e9 },
    ).owners.get("/s/lib.ts")!.count,
    2,
  );
});

test("pinned entries (loaded on every page) never take page code", () => {
  // core {app, page}, page-only {page}: tiny, adjacent — but they disagree on the pinned app entry.
  const graph = [entry("app", ["/s/core.ts"], { pinned: true }), entry("page", ["/s/page.ts"]), mod("/s/page.ts", 10, ["/s/core.ts"]), mod("/s/core.ts", 10)];
  assert.equal(coLoadGroups(graph, { budget: 1e9 }).size, 0);
  const unpinned = graph.map((m) => ({ ...m, pinned: false }));
  assert.equal(coLoadGroups(unpinned, { budget: 1e9 }).get("/s/page.ts"), coLoadGroups(unpinned, { budget: 1e9 }).get("/s/core.ts"));
  assert.ok(coLoadGroups(unpinned, { budget: 1e9 }).get("/s/core.ts"));
});

test("the owner walk stops at large barrels (the bundler links importers to the re-exported modules they use)", () => {
  // a and b both import the barrel; through it one + two would look used by both and take c (a only) in.
  const graph = [
    entry("a", ["/s/c.ts", "/s/index.ts"]),
    entry("b", ["/s/index.ts", "/s/two.ts"]),
    mod("/s/c.ts", 10, ["/s/one.ts"]),
    mod("/s/index.ts", 40, ["/s/one.ts", "/s/two.ts", "/s/three.ts", "/s/four.ts", "/s/five.ts"], { barrel: true }),
    mod("/s/one.ts", 10_000),
    mod("/s/two.ts", 10_000),
    ...["three", "four", "five"].map((n) => mod(`/s/${n}.ts`, 10)),
  ];
  assert.equal(coLoadGroups(graph).size, 0);
  const flat = coLoadGroups(graph.map((m) => ({ ...m, barrel: false })));
  assert.ok(flat.get("/s/c.ts") && flat.get("/s/c.ts") === flat.get("/s/one.ts"));
});

test("only merged groups of several owners are named; names are unique and deterministic", () => {
  // index {a, b} + x {a, b, c} merge (c loads 100 B extra for one request less of a and b), in two families.
  const family = (dir: string, [a, b, c]: string[]) => [
    entry(a!, [`/p/${dir}/index.ts`]),
    entry(b!, [`/p/${dir}/index.ts`]),
    entry(c!, [`/p/${dir}/x.ts`]),
    mod(`/p/${dir}/index.ts`, 100, [`/p/${dir}/x.ts`]),
    mod(`/p/${dir}/x.ts`, 10),
  ];
  const graph = [
    ...family("one", ["a", "b", "c"]),
    ...family("two", ["d", "e", "f"]),
    entry("g", ["/p/solo.ts"]),
    mod("/p/solo.ts", 5, ["/p/solo2.ts"]),
    mod("/p/solo2.ts", 5),
  ];
  const groups = coLoadGroups(graph);
  assert.equal(groups.get("/p/one/index.ts"), "rivet-merge-index");
  assert.equal(groups.get("/p/one/x.ts"), "rivet-merge-index");
  assert.equal(groups.get("/p/two/index.ts"), "rivet-merge-index-1");
  assert.equal(groups.get("/p/two/x.ts"), "rivet-merge-index-1");
  // One owner: stays in that entry's chunk (no name).
  assert.equal(groups.get("/p/solo.ts"), undefined);
  assert.deepEqual([...coLoadGroups(graph)], [...groups]);
});

test("input order does not change groups or names (modules are sorted by id)", () => {
  const family = (dir: string, [a, b, c]: string[]) => [
    entry(a!, [`/p/${dir}/index.ts`]),
    entry(b!, [`/p/${dir}/index.ts`]),
    entry(c!, [`/p/${dir}/x.ts`]),
    mod(`/p/${dir}/index.ts`, 100, [`/p/${dir}/x.ts`]),
    mod(`/p/${dir}/x.ts`, 10),
  ];
  const graph = [...family("one", ["a", "b", "c"]), ...family("two", ["d", "e", "f"]), ...family("three", ["g", "h", "i"])];
  const expected = JSON.stringify([...coLoadGroups(graph)].sort());
  assert.equal(JSON.parse(expected).length, 6);
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff);
  for (let round = 0; round < 20; round++) {
    const shuffled = [...graph];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    assert.equal(JSON.stringify([...coLoadGroups(shuffled)].sort()), expected);
  }
  assert.equal(JSON.stringify([...coLoadGroups([...graph].reverse())].sort()), expected);
});

test("no merge closes an import cycle through a module outside both groups (dynamic-import target, virtual, entry)", () => {
  // A {s1,s2} imports B (own chunk: dynamically imported elsewhere) and C {s1,s2,s3}; B imports C. Merging A + C
  // would make chunk(A+C) import chunk(B) and chunk(B) import chunk(A+C).
  const graph = [
    entry("s1", ["/s/A.ts"]),
    entry("s2", ["/s/A.ts"]),
    entry("s3", ["/s/C.ts"]),
    mod("/s/A.ts", 300, ["/s/B.ts", "/s/C.ts"]),
    mod("/s/B.ts", 4000, ["/s/C.ts"], { groupable: false }),
    mod("/s/C.ts", 200),
  ];
  assert.equal(coLoadGroups(graph, { budget: 1e9 }).size, 0);
  // Through another group: A {s1,s2} → M {s1,s2,s4} → C, A → C; C used by s3 too.
  const viaGroup = [
    entry("s1", ["/s/A.ts"]),
    entry("s2", ["/s/A.ts"]),
    entry("s3", ["/s/C.ts"]),
    entry("s4", ["/s/M.ts"]),
    mod("/s/A.ts", 30, ["/s/M.ts", "/s/C.ts"]),
    mod("/s/M.ts", 30_000, ["/s/C.ts"]),
    mod("/s/C.ts", 20),
  ];
  const groups = coLoadGroups(viaGroup, { budget: 100 });
  assert.ok(!(groups.get("/s/A.ts") && groups.get("/s/A.ts") === groups.get("/s/C.ts")), JSON.stringify([...groups]));
  // Without the B → C edge there is no cycle and the pair merges.
  const acyclic = graph.map((m) => (m.id === "/s/B.ts" ? { ...m, imports: [] } : m));
  const merged = coLoadGroups(acyclic, { budget: 1e9 });
  assert.ok(merged.get("/s/A.ts") && merged.get("/s/A.ts") === merged.get("/s/C.ts"));
});

test("the cycle check covers merged groups: a group joining A + B may not reach A through an ungrouped module", () => {
  // A {s1,s2,s4} → B; C {s4} imports B and X (own chunk), X imports A. A + B merge; C next to the merged group would
  // make chunk(A+B+C) → chunk(X) → chunk(A+B+C).
  const graph = (xImportsA: boolean) => [
    entry("s1", ["/s/A.ts"]),
    entry("s2", ["/s/A.ts"]),
    entry("s3", ["/s/B.ts"]),
    entry("s4", ["/s/C.ts"]),
    mod("/s/A.ts", 10, ["/s/B.ts"]),
    mod("/s/B.ts", 10),
    mod("/s/C.ts", 10, ["/s/B.ts", "/s/X.ts"]),
    mod("/s/X.ts", 10, xImportsA ? ["/s/A.ts"] : [], { groupable: false }),
  ];
  const groups = coLoadGroups(graph(true), { budget: 1e9 });
  assert.ok(groups.get("/s/A.ts") && groups.get("/s/A.ts") === groups.get("/s/B.ts"));
  assert.notEqual(groups.get("/s/C.ts"), groups.get("/s/A.ts"));
  // Without X → A there is no path back: C joins.
  const control = coLoadGroups(graph(false), { budget: 1e9 });
  assert.ok(control.get("/s/C.ts") && control.get("/s/C.ts") === control.get("/s/A.ts"));
});

test("the budget is amortised over entries and checked per merge step (not a per-entry cap)", () => {
  // 100 entries use hub + 20 satellites of 1.5 KB (satellite i: every entry but e<i>, so each is its own chunk); one
  // entry uses the hub only. Each merge costs the lone entry (and e<i>) 1.5 KB for 99 requests saved, so all 20 merge:
  // the lone entry loads 30 KB it does not need (documented: chunks.md "Fewer shared chunks").
  const sats = Array.from({ length: 20 }, (_, i) => `/s/sat${String(i).padStart(2, "0")}.ts`);
  const graph: CoLoadModule[] = [];
  for (let i = 0; i < 100; i++) graph.push(entry(`e${i}`, ["/s/hub.ts", ...sats.filter((_, j) => j !== i)]));
  graph.push(entry("lone", ["/s/hub.ts"]), mod("/s/hub.ts", 100));
  for (const s of sats) graph.push(mod(s, 1500, ["/s/hub.ts"]));
  const groups = coLoadGroups(graph);
  assert.equal(sats.filter((s) => groups.get(s) && groups.get(s) === groups.get("/s/hub.ts")).length, 20);
  // One step over budget per request saved stays apart: a 300 KB satellite costs 2 × 300 KB / 99 > 2048.
  const big = graph.map((m) => (m.id === sats[0] ? { ...m, size: 300_000 } : m));
  assert.notEqual(coLoadGroups(big).get(sats[0]!), coLoadGroups(big).get("/s/hub.ts"));
});

test("an always-loaded entry importing a large barrel: what it may load through it is never grouped", () => {
  // app (pinned) → index (barrel) → X; X {s1,s2} → Y {s1,s2,s3}. X may be on every page: Y must not join it.
  const graph = [
    entry("app", ["/s/index.ts"], { pinned: true }),
    entry("s1", ["/s/X.ts"]),
    entry("s2", ["/s/X.ts"]),
    entry("s3", ["/s/Y.ts"]),
    mod("/s/index.ts", 50, ["/s/X.ts", "/s/other.ts", "/s/o2.ts", "/s/o3.ts", "/s/o4.ts"], { barrel: true }),
    mod("/s/other.ts", 10),
    ...["o2", "o3", "o4"].map((n) => mod(`/s/${n}.ts`, 10)),
    mod("/s/X.ts", 500, ["/s/Y.ts"]),
    mod("/s/Y.ts", 3000),
  ];
  assert.equal(coLoadGroups(graph, { budget: 1e9 }).size, 0);
  // A non-pinned entry importing the barrel still stops there (X, Y merge).
  const page = graph.map((m) => (m.id === "app" ? { ...m, pinned: false } : m));
  const groups = coLoadGroups(page);
  assert.ok(groups.get("/s/X.ts") && groups.get("/s/X.ts") === groups.get("/s/Y.ts"));
});

test("dynamically imported modules own what they load, and ungrouped imports are costed", () => {
  // hub {s1, s2, lazy} ← big {s1, s2}: merging makes the lazily imported module load big's bytes.
  const graph = (bigSize: number) => [
    entry("s1", ["/s/big.ts"]),
    entry("s2", ["/s/big.ts"]),
    entry("lazy", ["/s/hub.ts"]),
    mod("/s/big.ts", bigSize, ["/s/hub.ts"]),
    mod("/s/hub.ts", 100),
  ];
  // 5 KB for the lazy module / 2 requests saved > 2048.
  assert.equal(coLoadGroups(graph(5000)).size, 0);
  const small = coLoadGroups(graph(1000));
  assert.ok(small.get("/s/big.ts") && small.get("/s/big.ts") === small.get("/s/hub.ts"));
  // X {s1,s2} imports Z {s1,s2,s3} and D (an own chunk, 40 KB, which s3 does not load): s3 would load D too.
  const loose = [
    entry("s1", ["/s/X.ts"]),
    entry("s2", ["/s/X.ts"]),
    entry("s3", ["/s/Z.ts"]),
    mod("/s/X.ts", 100, ["/s/Z.ts", "/s/D.ts"]),
    mod("/s/D.ts", 40_000, [], { entry: true, groupable: false }),
    mod("/s/Z.ts", 100),
  ];
  assert.equal(coLoadGroups(loose).size, 0);
  const light = loose.map((m) => (m.id === "/s/D.ts" ? { ...m, size: 10 } : m));
  assert.ok(coLoadGroups(light).get("/s/X.ts"));
});

test("withMergeGroup: appended after the user's groups; skipped for codeSplitting: false, manualChunks, advancedChunks", () => {
  const name = (id: string) => (id === "/a.ts" ? MERGE_PREFIX + "a" : null);
  const plain = withMergeGroup({ format: "es" }, name) as unknown as {
    codeSplitting: { groups: { debugName: string; includeDependenciesRecursively: boolean }[] };
  };
  assert.equal(plain.codeSplitting.groups.length, 1);
  assert.equal(plain.codeSplitting.groups[0]!.debugName, "rivet-merge");
  assert.equal(plain.codeSplitting.groups[0]!.includeDependenciesRecursively, false);
  const user = { name: "vendor", test: /node_modules/ };
  const own = withMergeGroup({ codeSplitting: { minSize: 10, groups: [user] } }, name) as { codeSplitting: { minSize: number; groups: unknown[] } };
  assert.equal(own.codeSplitting.minSize, 10);
  assert.equal(own.codeSplitting.groups[0], user);
  assert.equal(own.codeSplitting.groups.length, 2);
  assert.ok(withMergeGroup({ codeSplitting: true }, name));
  assert.equal(withMergeGroup({ codeSplitting: false }, name), undefined);
  assert.equal(withMergeGroup({ manualChunks: () => null }, name), undefined);
  assert.equal(withMergeGroup({ advancedChunks: { groups: [user] } }, name), undefined);
});

test("isBarrel: re-export-only modules and mostly-re-export package indexes", () => {
  assert.equal(isBarrel(`export { a } from "./a.js";\nexport * from "./b.js";\n// note\nimport "./c.js";\n`), true);
  assert.equal(isBarrel(`import { a } from "./a.js";\nexport { a };\n`), true);
  assert.equal(isBarrel(`export { a } from "./a.js";\nexport const b = 1;\n`), false);
  assert.equal(isBarrel(`const x = 1;`), false);
  const many = Array.from({ length: 12 }, (_, i) => `export { default as I${i} } from "./icons/i${i}.js";`).join("\n");
  assert.equal(isBarrel(many + "\nconst helper = (x) => x;\nexport { helper };\n"), true);
});

test("cap: an entry over the cap merges the cheapest pair of its groups past the budget; pinned entries are skipped", () => {
  // a loads x {a,b}, y {a,c}, z {a,d}: three groups, each shared with one other entry. Budget 0 merges nothing.
  const graph = [
    entry("a", ["/s/x.ts", "/s/y.ts", "/s/z.ts"]),
    entry("b", ["/s/x.ts"]),
    entry("c", ["/s/y.ts"]),
    entry("d", ["/s/z.ts"]),
    mod("/s/x.ts", 100),
    mod("/s/y.ts", 5000),
    mod("/s/z.ts", 200),
  ];
  assert.equal(coLoadGroups(graph, { budget: 0 }).size, 0);
  // Cap 2: the cheapest pair (x + z: b and d load 200 / 100 extra) merges; y stays apart.
  const two = coLoadGroups(graph, { budget: 0, cap: 2 });
  assert.ok(two.get("/s/x.ts"));
  assert.equal(two.get("/s/x.ts"), two.get("/s/z.ts"));
  assert.equal(two.get("/s/y.ts"), undefined);
  // Cap 1: everything a loads merges into one chunk.
  const one = coLoadGroups(graph, { budget: 0, cap: 1 });
  assert.equal(new Set([one.get("/s/x.ts"), one.get("/s/y.ts"), one.get("/s/z.ts")]).size, 1);
  // A pinned entry (every page) never takes page code: groups disagreeing on it do not merge for another entry's cap.
  const pinnedB = graph.map((m) => (m.id === "b" ? { ...m, pinned: true } : m));
  const capped = coLoadGroups(pinnedB, { budget: 0, cap: 1 });
  assert.equal(capped.get("/s/x.ts"), undefined);
  assert.equal(capped.get("/s/y.ts"), capped.get("/s/z.ts"));
  // A pinned entry over the cap itself is skipped: its owner sets over-count (barrels), a cap would merge page code.
  const pinnedA = graph.map((m) => (m.id === "a" ? { ...m, pinned: true } : m));
  assert.equal(coLoadGroups(pinnedA, { budget: 0, cap: 1 }).size, 0);
});

test("the owner walk goes through small barrels (a component's index.ts), not large ones", () => {
  // a, b → card.tsx → ./card/index.ts (barrel: card.styles.ts); c uses the barrel directly. Through the small barrel
  // the styles get owners {a,b,c}, adjacent to the card {a,b}: merged within budget (c takes the card's 3000 B for 2
  // requests saved). A 5-import barrel still stops the walk: its leaves stay unowned.
  const small = [
    entry("a", ["/s/card.tsx"]),
    entry("b", ["/s/card.tsx"]),
    entry("c", ["/s/card/index.ts"]),
    mod("/s/card.tsx", 3000, ["/s/card/index.ts"]),
    mod("/s/card/index.ts", 50, ["/s/card/card.styles.ts"], { barrel: true }),
    mod("/s/card/card.styles.ts", 200),
  ];
  const groups = coLoadGroups(small);
  assert.ok(groups.get("/s/card/card.styles.ts"));
  assert.equal(groups.get("/s/card/card.styles.ts"), groups.get("/s/card.tsx"));
  const wide = [
    entry("a", ["/s/card.tsx"]),
    entry("b", ["/s/card.tsx"]),
    mod("/s/card.tsx", 3000, ["/s/lib/index.ts"]),
    mod("/s/lib/index.ts", 50, ["/s/lib/a.ts", "/s/lib/b.ts", "/s/lib/c.ts", "/s/lib/d.ts", "/s/lib/e.ts"], { barrel: true }),
    ...["a", "b", "c", "d", "e"].map((n) => mod(`/s/lib/${n}.ts`, 200)),
  ];
  assert.equal(coLoadGroups(wide).get("/s/lib/a.ts"), undefined);
});

test("hub pass: groups most entries load merge with each other without an import edge", () => {
  // Four entries; x {a,b,c} and y {b,c,d} are small helpers no module of the other imports: not adjacent, but hubs.
  const graph = [
    entry("a", ["/s/x.ts"]),
    entry("b", ["/s/x.ts", "/s/y.ts"]),
    entry("c", ["/s/x.ts", "/s/y.ts"]),
    entry("d", ["/s/y.ts"]),
    mod("/s/x.ts", 300),
    mod("/s/y.ts", 300),
  ];
  const groups = coLoadGroups(graph);
  assert.ok(groups.get("/s/x.ts"));
  assert.equal(groups.get("/s/x.ts"), groups.get("/s/y.ts"));
  // Over budget (a loads y's 300, d loads x's 300: 300 per request saved) they stay apart.
  assert.equal(coLoadGroups(graph, { budget: 200 }).size, 0);
  // Hubs are relative to the most-shared group: next to w (16 entries), x and y (3 each: under a quarter) are no hubs.
  const wide = [...graph, ...["e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"].map((n) => entry(n, ["/s/w.ts"])), mod("/s/w.ts", 100)];
  for (const e of wide) if (e.entry && ["a", "b", "c", "d"].includes(e.id)) e.imports = [...e.imports, "/s/w.ts"];
  assert.equal(coLoadGroups(wide).get("/s/x.ts"), undefined);
});

// PLACE (phase 1): the placement pass (`place.ts` + Rust `rust/src/place/*`) over real module facts. The heuristic table
// reproduces today's call-site verdicts exactly; a priced table drops `site` where its props cost more than the adopt it
// saves and keeps it where the parent's adopt is large; the solver never costs more than today's assignment and matches
// brute force on small graphs.
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { moduleFacts, type ModuleFacts } from "../index.ts";
import { call } from "../wasm.ts";
import { HEURISTIC, explainText, placeVerdicts, type PlacementGraph, type PlacementTable } from "../place.ts";

const CTX = `import { createContext, useContext } from "@rivetjs/reactivity";
export const ThemeContext = createContext("light");
export function useTheme() { return useContext(ThemeContext); }`;

// `Part` reads a context (dependent) and has a props object: `site_capable`.
const PARTS = `import { signal, useContext } from "@rivetjs/reactivity";
import { ThemeContext } from "./ctx.tsx";
export function Part(props: { label: string }) {
  const theme = useContext(ThemeContext);
  const n = signal(0);
  return <button class={theme} onClick={() => n.set(n() + 1)}>{props.label}{n()}</button>;
}`;

function app(page: string) {
  const sources: Record<string, string> = { "src/ctx.tsx": CTX, "src/parts.tsx": PARTS, "src/page.tsx": page };
  const facts = new Map<string, ModuleFacts>();
  for (const [file, source] of Object.entries(sources)) facts.set(file, moduleFacts(source, file, { boundaries: true, refs: true }));
  const resolved = new Map<string, Map<string, string>>();
  for (const file of Object.keys(sources)) {
    const map = new Map<string, string>();
    for (const [, { from }] of facts.get(file)!.imports) if (from.startsWith("./")) map.set(from, "src/" + from.slice(2));
    resolved.set(file, map);
  }
  const verdicts = boundaryFacts(facts, resolved, new Set(), new Set(["src/page.tsx"]), {
    external: (_file, spec) => (spec.startsWith("@rivetjs/") ? null : "pkg:" + spec),
    hosts: new Set(),
  });
  const bytes = new Map(Object.entries(sources).map(([file, source]) => [file, source.length]));
  const place = (table: PlacementTable) => placeVerdicts({ facts, verdicts, bytes, pages: ["src/page.tsx?Demo"], table, explain: true });
  return { verdicts, place };
}

// A wrapper page (one part, nothing else to adopt) passing a long literal class; a multi-part page with a large static body.
const WRAPPER = `import { Part } from "./parts.tsx";
export default function Demo() { return <div><Part label="${"x".repeat(600)}" /></div>; }`;
const MULTI = `import { signal } from "@rivetjs/reactivity";
import { Part } from "./parts.tsx";
export default function Demo() {
  const n = signal(0);
  return (
    <main>
      <button onClick={() => n.set(n() + 1)}>{n()}</button>
      ${"<section><h2>t</h2><p>a</p><p>b</p><ul><li>1</li><li>2</li></ul></section>".repeat(20)}
      <Part label="short" />
    </main>
  );
}`;

// Bytes dear, adopt cheap: a wrapper's `site` (600 B of props for one element less to adopt) does not pay.
const BYTES: PlacementTable = { kind: "custom", htmlMsPerByte: 0.01, recordBytes: 20, propsRatio: 1, adoptMsPerElement: 0.002, pInteract: 1 };

test("heuristic table: placed verdicts = today's call-site marks (every proven site), solved, agreeing", () => {
  for (const page of [WRAPPER, MULTI]) {
    const { verdicts, place } = app(page);
    const placed = place(HEURISTIC);
    assert.equal(placed.agrees, true);
    assert.deepEqual(placed.result.sites, placed.result.legal);
    assert.deepEqual(placed.sites("src/page.tsx"), verdicts.callSites!.sites("src/page.tsx"));
    assert.deepEqual(placed.site("src/parts.tsx"), verdicts.callSites!.site("src/parts.tsx"));
    assert.deepEqual(placed.sites("src/page.tsx"), ["Demo:0"]);
    assert.ok(placed.result.variables >= 1);
  }
});

test("priced table: a wrapper's site drops to with-parent; a multi-part page keeps it (adopt saved > props)", () => {
  const wrapper = app(WRAPPER).place(BYTES);
  assert.deepEqual(wrapper.sites("src/page.tsx"), []);
  assert.deepEqual(wrapper.site("src/parts.tsx"), []);
  assert.ok(wrapper.result.cost.chosen < wrapper.result.cost.today);
  const multi = app(MULTI).place(BYTES);
  assert.deepEqual(multi.sites("src/page.tsx"), ["Demo:0"]);
  assert.ok(multi.result.cost.chosen <= multi.result.cost.today);
  const text = explainText(wrapper, { all: true });
  assert.match(text, /\* with-parent +src\/page\.tsx\?Demo → <Part>/);
  assert.match(text, /if site: \+/);
});

// Synthetic graphs straight to the op: a chain root → wrappers → parts; brute force over every assignment.
function synthetic(seed: number, parts: number): { graph: PlacementGraph; table: PlacementTable } {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const base = { interactive: true, source: false, live: false, adopted: true, independent: false, free: false, root: false, siteCapable: false, lite: false };
  const components: PlacementGraph["components"] = [{ ...base, id: "root", module: 0, elements: 1 + Math.floor(rnd() * 40) }];
  const sites: PlacementGraph["sites"] = [];
  const wrappers = 1 + Math.floor(rnd() * 3);
  for (let w = 0; w < wrappers; w++) {
    components.push({ ...base, id: "w" + w, module: 1 + w, elements: Math.floor(rnd() * 30), source: rnd() < 0.3 });
    sites.push({ caller: 0, callee: components.length - 1, index: w, bytes: 0, proof: "", demoted: false });
  }
  for (let i = 0; i < parts; i++) {
    components.push({ ...base, id: "p" + i, module: 4 + (i % 3), elements: 1 + Math.floor(rnd() * 5), source: true, siteCapable: true });
    sites.push({
      caller: 1 + Math.floor(rnd() * wrappers),
      callee: components.length - 1,
      index: 10 + i,
      bytes: Math.floor(rnd() * 400),
      proof: rnd() < 0.85 ? "proven" : "overlap",
      demoted: rnd() < 0.1,
    });
  }
  const modules = Array.from({ length: 7 }, (_, i) => ({ id: "m" + i, bytes: Math.floor(rnd() * 3000) }));
  const table: PlacementTable = {
    kind: "custom",
    htmlMsPerByte: rnd() * 0.01,
    jsMsPerByte: rnd() * 0.005,
    recordBytes: 20,
    propsRatio: 1,
    adoptMsPerElement: rnd() * 0.05,
    adoptMsPerRecord: rnd() * 0.1,
    pInteract: 0.5,
    runtimeFullMs: 50,
  };
  return { graph: { modules, components, sites, pages: [{ id: "page", root: 0, weight: 1 }] }, table };
}

test("solver: exact = brute force on small graphs; local search never worse than today's", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const parts = seed % 5 === 0 ? 14 : 2 + (seed % 7);
    const { graph, table } = synthetic(seed, parts);
    const out = call<{ sites: boolean[]; legal: boolean[]; method: string; cost: { today: number; chosen: number } }>({ op: "place", graph, table });
    const vars = out.legal.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    const cost = (x: boolean[]) => call<{ cost: number }>({ op: "place", graph, table, evaluate: x }).cost;
    assert.ok(out.cost.chosen <= out.cost.today + 1e-9, `seed ${seed}`);
    assert.ok(Math.abs(cost(out.sites) - out.cost.chosen) < 1e-6, `seed ${seed}: reported cost`);
    if (vars.length > 12) {
      assert.equal(out.method, "local-search");
      continue;
    }
    assert.equal(out.method, "exact");
    let best = Infinity;
    for (let mask = 0; mask < 1 << vars.length; mask++) {
      const x = out.legal.map(() => false);
      vars.forEach((v, k) => (x[v] = (mask & (1 << k)) !== 0));
      best = Math.min(best, cost(x));
    }
    assert.ok(Math.abs(best - out.cost.chosen) < 1e-6, `seed ${seed}: exact ${out.cost.chosen} vs brute ${best}`);
  }
});

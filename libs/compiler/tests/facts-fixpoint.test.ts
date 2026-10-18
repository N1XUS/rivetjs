// Derived model (M2 C1): the cross-module boundary fixpoint over hand-built module facts (no wasm needed).
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import type { ComponentBoundaryFacts, ModuleFacts } from "../index.ts";

type Component = Omit<Partial<ComponentBoundaryFacts>, "renders"> & { renders?: string[] };

/** A module's facts from its components (name → partial boundary facts) and imports (local → [from, imported]). */
function module(components: Record<string, Component>, imports: Record<string, [string, string]> = {}, defaultName: string | null = null): ModuleFacts {
  const boundaries = new Map<string, ComponentBoundaryFacts>();
  for (const [name, c] of Object.entries(components))
    boundaries.set(name, {
      interactive: c.interactive ?? false,
      context: c.context ?? false,
      params: c.params ?? "object",
      renders: new Set(c.renders ?? []),
      calls: c.calls ?? (c.renders ?? []).map((tag) => ({ tag, data: true })),
    });
  return {
    imports: new Map(Object.entries(imports).map(([local, [from, imported]]) => [local, { from, imported }])),
    statics: new Set(Object.values(imports).map(([from]) => from)),
    dynamics: new Set(),
    components: new Map([...boundaries.keys()].map((name) => [name, new Set<string>()])),
    groups: [],
    preload: null,
    defaultName,
    boundaries,
  };
}

test("interactive closes over rendered components across modules", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/page.tsx",
      module({ Page: { renders: ["Shell", "Counter"], params: "destructured" }, Shell: { renders: [] } }, { Counter: ["./counter", "Counter"] }, "Page"),
    ],
    ["src/counter.tsx", module({ Counter: { interactive: true }, Label: {} })],
  ]);
  const resolved = new Map([["src/page.tsx", new Map([["./counter", "src/counter.tsx"]])]]);
  const out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]));
  assert.deepEqual(out.boundaries("src/page.tsx"), ["Page"]);
  assert.deepEqual(out.boundaries("src/counter.tsx"), ["Counter"]);
  assert.equal(out.verdicts.get("src/page.tsx")!.get("Shell")!.dependentBecause, "not-interactive");
  // The route root is independent by definition (destructured props notwithstanding); Counter: data-only call site.
  assert.deepEqual(out.independent("src/page.tsx"), ["Page"]);
  assert.deepEqual(out.independent("src/counter.tsx"), ["Counter"]);
});

test("a chain of renders reaches a fixpoint (A renders B renders C, C interactive)", () => {
  const facts = new Map<string, ModuleFacts>([["src/m.tsx", module({ A: { renders: ["B"] }, B: { renders: ["C"] }, C: { interactive: true } })]]);
  const out = boundaryFacts(facts, new Map());
  assert.deepEqual(out.boundaries("src/m.tsx"), ["A", "B", "C"]);
});

test("independent needs a props object, no context and data at every call site", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/m.tsx",
      module({
        App: {
          interactive: true,
          renders: ["Data", "Fn", "Ctx", "Destructured", "Mixed"],
          calls: [
            { tag: "Data", data: true },
            { tag: "Fn", data: false },
            { tag: "Ctx", data: true },
            { tag: "Destructured", data: true },
            { tag: "Mixed", data: true },
          ],
        },
        Data: { interactive: true },
        Fn: { interactive: true },
        Ctx: { interactive: true, context: true },
        Destructured: { interactive: true, params: "destructured" },
        Mixed: { interactive: true },
        Other: { interactive: true, renders: ["Mixed"], calls: [{ tag: "Mixed", data: false }] },
        Orphan: { interactive: true },
      }),
    ],
  ]);
  const out = boundaryFacts(facts, new Map());
  const v = out.verdicts.get("src/m.tsx")!;
  assert.deepEqual(out.independent("src/m.tsx"), ["Data"]);
  assert.equal(v.get("Fn")!.dependentBecause, "call-site");
  assert.equal(v.get("Ctx")!.dependentBecause, "context");
  assert.equal(v.get("Destructured")!.dependentBecause, "destructured-props");
  assert.equal(v.get("Mixed")!.dependentBecause, "call-site");
  assert.equal(v.get("Orphan")!.dependentBecause, "no-call-site");
  assert.equal(v.get("App")!.dependentBecause, "no-call-site");
});

test("default imports resolve through the target module's defaultName; unresolved tags never count", () => {
  const facts = new Map<string, ModuleFacts>([
    ["src/a.tsx", module({ A: { renders: ["Widget", "ns.Thing", "Missing"] } }, { Widget: ["./w", "default"], Missing: ["./missing", "Missing"] })],
    ["src/w.tsx", module({ W: { interactive: true } }, {}, "W")],
  ]);
  const resolved = new Map([["src/a.tsx", new Map([["./w", "src/w.tsx"]])]]);
  const out = boundaryFacts(facts, resolved);
  assert.deepEqual(out.boundaries("src/a.tsx"), ["A"]);
  assert.deepEqual(out.independent("src/w.tsx"), ["W"]);
  assert.deepEqual(out.boundaries("src/none.tsx"), []);
});

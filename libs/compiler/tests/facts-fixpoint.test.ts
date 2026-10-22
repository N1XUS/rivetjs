// Derived model (M2 C1): the cross-module boundary fixpoint over hand-built module facts (no wasm needed).
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import type { ComponentBoundaryFacts, ModuleFacts } from "../index.ts";

type Call = { tag: string; data: boolean; fn?: boolean; around?: string[]; inputs?: boolean };
type Component = Omit<Partial<ComponentBoundaryFacts>, "renders" | "calls"> & { renders?: string[]; calls?: Call[] };

/** A module's facts from its components (name → partial boundary facts) and imports (local → [from, imported]). */
function module(
  components: Record<string, Component>,
  imports: Record<string, [string, string]> = {},
  defaultName: string | null = null,
  extra: Partial<Pick<ModuleFacts, "exports" | "reexports" | "stars" | "compounds">> = {},
): ModuleFacts {
  const boundaries = new Map<string, ComponentBoundaryFacts>();
  for (const [name, c] of Object.entries(components))
    boundaries.set(name, {
      interactive: c.interactive ?? false,
      // Pre-6b cases: every own site is a source unless the case says otherwise.
      source: c.source ?? c.interactive ?? false,
      provides: c.provides ?? false,
      context: c.context ?? false,
      params: c.params ?? "object",
      renders: new Set(c.renders ?? []),
      calls: (c.calls ?? (c.renders ?? []).map((tag) => ({ tag, data: true }))).map((call) => ({
        fn: false,
        around: [],
        inputs: call.data,
        ...call,
      })),
    });
  return {
    imports: new Map(Object.entries(imports).map(([local, [from, imported]]) => [local, { from, imported }])),
    statics: new Set(Object.values(imports).map(([from]) => from)),
    dynamics: new Set(),
    components: new Map([...boundaries.keys()].map((name) => [name, new Set<string>()])),
    groups: [],
    preload: null,
    defaultName,
    exports: extra.exports ?? new Map(),
    reexports: extra.reexports ?? new Map(),
    stars: extra.stars ?? [],
    compounds: extra.compounds ?? new Map(),
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

test('an anonymous default export (facts name "default", no defaultName) resolves for default imports and route roots', () => {
  const facts = new Map<string, ModuleFacts>([
    ["src/routes/index.tsx", module({ default: { renders: ["Widget"] } }, { Widget: ["../widget", "default"] })],
    ["src/widget.tsx", module({ default: { interactive: true } })],
  ]);
  const resolved = new Map([["src/routes/index.tsx", new Map([["../widget", "src/widget.tsx"]])]]);
  const result = boundaryFacts(facts, resolved, new Set(["src/routes/index.tsx"]));
  assert.deepEqual(result.boundaries("src/routes/index.tsx"), ["default"]);
  assert.deepEqual(result.independent("src/routes/index.tsx"), ["default"]);
  assert.deepEqual(result.independent("src/widget.tsx"), ["default"]);
});

// M6-PARITY 6b (user ruling 2026-10-22): props are live when the caller passes a reactive value; literals are static.
test("6b: a component whose sites only read its props is a boundary only when a live caller feeds it", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/routes/index.tsx",
      module(
        {
          default: {
            renders: ["Meter", "Counter", "Live"],
            calls: [
              { tag: "Meter", data: true },
              { tag: "Counter", data: true },
              { tag: "Live", data: true },
            ],
          },
        },
        { Meter: ["../meter", "Meter"], Counter: ["../counter", "Counter"], Live: ["../counter", "Live"] },
      ),
    ],
    ["src/meter.tsx", module({ Meter: { interactive: true, source: false } })],
    [
      "src/counter.tsx",
      module(
        {
          // Keyed state + a handler; passes its signal's value on to a reading-only component.
          Counter: { interactive: true, source: true, renders: ["Meter"], calls: [{ tag: "Meter", data: false }] },
          // No state, passes a callback: the callee's inputs are live.
          Live: { renders: ["Fill"], calls: [{ tag: "Fill", data: false, fn: true }] },
          Fill: { interactive: true, source: false },
        },
        { Meter: ["./meter", "Meter"] },
      ),
    ],
  ]);
  const resolved = new Map([
    [
      "src/routes/index.tsx",
      new Map([
        ["../meter", "src/meter.tsx"],
        ["../counter", "src/counter.tsx"],
      ]),
    ],
    ["src/counter.tsx", new Map([["./meter", "src/meter.tsx"]])],
  ]);
  const only = (static_: boolean) => {
    const f = new Map(facts);
    // Without Counter's call, the Meter is only rendered with literals.
    if (static_) f.set("src/counter.tsx", module({ Counter: { interactive: true, source: true } }));
    return boundaryFacts(f, resolved, new Set(["src/routes/index.tsx"]));
  };
  assert.deepEqual(only(true).boundaries("src/meter.tsx"), []);
  assert.equal(only(true).verdicts.get("src/meter.tsx")!.get("Meter")!.dependentBecause, "not-interactive");
  const out = only(false);
  assert.deepEqual(out.boundaries("src/meter.tsx"), ["Meter"]);
  assert.equal(out.verdicts.get("src/meter.tsx")!.get("Meter")!.because, "live-props");
  assert.deepEqual(out.boundaries("src/counter.tsx"), ["Counter", "Live", "Fill"]);
  assert.equal(out.verdicts.get("src/counter.tsx")!.get("Live")!.because, "renders");
  // Conditional (no change source of its own): the server keeps such a record per live instance only.
  assert.deepEqual(out.conditional("src/meter.tsx"), ["Meter"]);
  assert.deepEqual(
    out.conditional("src/counter.tsx"),
    ["Live", "Fill"].filter((n) => out.verdicts.get("src/counter.tsx")!.get(n)!.because !== "source"),
  );
  assert.ok(!out.conditional("src/counter.tsx").includes("Counter"));
});

test("6b: context readers follow their provider's liveness (enclosing elements and callers)", () => {
  const page = (liveRoot: boolean) =>
    module(
      {
        default: {
          source: liveRoot,
          renders: ["Meter", "Output"],
          calls: [
            { tag: "Meter", data: false, inputs: !liveRoot },
            { tag: "Output", data: true, around: ["Meter"] },
          ],
        },
      },
      { Meter: ["../meter", "MeterRoot"], Output: ["../meter", "MeterOutput"] },
    );
  const meter = module({ MeterRoot: { interactive: true, source: false, provides: true }, MeterOutput: { interactive: true, source: false, context: true } });
  const resolved = new Map([["src/routes/index.tsx", new Map([["../meter", "src/meter.tsx"]])]]);
  for (const live of [false, true]) {
    const out = boundaryFacts(
      new Map([
        ["src/routes/index.tsx", page(live)],
        ["src/meter.tsx", meter],
      ]),
      resolved,
      new Set(["src/routes/index.tsx"]),
    );
    assert.deepEqual(out.boundaries("src/meter.tsx"), live ? ["MeterRoot", "MeterOutput"] : [], String(live));
  }
});

test("6b: tags resolve through re-export modules, export * and compound parts", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/routes/index.tsx",
      module(
        {
          default: {
            source: true,
            renders: ["Meter", "Meter.Output"],
            calls: [
              { tag: "Meter", data: false },
              { tag: "Meter.Output", data: false },
            ],
          },
        },
        { Meter: ["ui", "Meter"] },
      ),
    ],
    ["ui/index.ts", module({}, {}, null, { stars: ["./meter/index.ts"] })],
    [
      "ui/meter/index.ts",
      module({}, { MeterRoot: ["./meter.tsx", "MeterRoot"], MeterOutput: ["./meter.tsx", "MeterOutput"] }, null, {
        exports: new Map([["Meter", "Meter"]]),
        compounds: new Map([["Meter", { root: "MeterRoot", parts: new Map([["Output", "MeterOutput"]]) }]]),
      }),
    ],
    ["ui/meter/meter.tsx", module({ MeterRoot: { interactive: true }, MeterOutput: { interactive: true } })],
  ]);
  const resolved = new Map([
    ["src/routes/index.tsx", new Map([["ui", "ui/index.ts"]])],
    ["ui/index.ts", new Map([["./meter/index.ts", "ui/meter/index.ts"]])],
    ["ui/meter/index.ts", new Map([["./meter.tsx", "ui/meter/meter.tsx"]])],
  ]);
  // Pre-6b semantics for the callees (`interactive` own sites = sources): resolution is what this case checks.
  const out = boundaryFacts(facts, resolved, new Set(["src/routes/index.tsx"]));
  assert.deepEqual(out.boundaries("ui/meter/meter.tsx"), ["MeterRoot", "MeterOutput"]);
  assert.equal(out.verdicts.get("ui/meter/meter.tsx")!.get("MeterRoot")!.dependentBecause, "call-site");
  assert.equal(out.verdicts.get("ui/meter/meter.tsx")!.get("MeterOutput")!.dependentBecause, "call-site");
});

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
  extra: Partial<Pick<ModuleFacts, "exports" | "reexports" | "stars" | "compounds" | "componentValues">> = {},
): ModuleFacts {
  const boundaries = new Map<string, ComponentBoundaryFacts>();
  for (const [name, c] of Object.entries(components))
    boundaries.set(name, {
      interactive: c.interactive ?? false,
      // Pre-6b cases: every own site is a source unless the case says otherwise.
      source: c.source ?? c.interactive ?? false,
      provides: c.provides ?? false,
      listens: c.listens ?? false,
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
    ...(extra.componentValues ? { componentValues: extra.componentValues } : {}),
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

test("a component its module does not export, rendered only there, is dependent (it adopts with its parent)", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/routes/index.tsx",
      module({ Page: { renders: ["Toolbar"] }, Toolbar: { interactive: true }, Shown: { interactive: true } }, {}, "Page", {
        exports: new Map([
          ["default", "Page"],
          ["Shown", "Shown"],
        ]),
      }),
    ],
  ]);
  facts.get("src/routes/index.tsx")!.boundaries.get("Page")!.calls.push({ tag: "Shown", data: true, fn: false, around: [], inputs: true });
  const out = boundaryFacts(facts, new Map(), new Set(["src/routes/index.tsx"]));
  const v = out.verdicts.get("src/routes/index.tsx")!;
  assert.equal(v.get("Toolbar")!.dependentBecause, "not-exported");
  assert.equal(v.get("Shown")!.independent, true);
});

test("independent needs a props object, no context and data at every call site", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/m.tsx",
      module(
        {
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
        },
        {},
        null,
        { exports: new Map(["App", "Data", "Fn", "Ctx", "Destructured", "Mixed", "Other", "Orphan"].map((n) => [n, n])) },
      ),
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
// ORPHAN-B (2026-10-26): live data alone makes a component `live` (what it passes on), not a boundary — the boundary holding
// the change source runs it inline in its unit.
test("6b + ORPHAN-B: a component whose sites only read its props is live when a live caller feeds it, never a boundary", () => {
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
  const meter = out.verdicts.get("src/meter.tsx")!.get("Meter")!;
  assert.deepEqual(out.boundaries("src/meter.tsx"), []);
  assert.equal(meter.live, true);
  assert.equal(meter.interactive, false);
  assert.equal(meter.because, undefined);
  // Its live caller's unit adopts it: rendered by a boundary, so its server output keeps its slot markers.
  assert.equal(meter.adopted, true);
  // `Live` passes a function into `Fill`: behaviour handed in, so Fill stays a (conditional) boundary even where its
  // caller is one, and `Live` renders it.
  assert.deepEqual(out.boundaries("src/counter.tsx"), ["Counter", "Live", "Fill"]);
  assert.equal(out.verdicts.get("src/counter.tsx")!.get("Fill")!.because, "live-props");
  assert.deepEqual(out.conditional("src/meter.tsx"), []);
  assert.deepEqual(out.conditional("src/counter.tsx"), ["Live", "Fill"]);
  assert.equal(out.verdicts.get("src/counter.tsx")!.get("Counter")!.because, "source");
});

test("ORPHAN-B: live data makes a boundary only where an instance may render outside every boundary", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/page.tsx",
      module(
        {
          // No resolved call site (a frame page, rendered by code the walk does not see): its inputs count as live, and
          // nothing proves a boundary around it — its helpers' hidden sources (`createInView`) need it as one.
          Page: {
            interactive: true,
            source: false,
            renders: ["Row", "Cell"],
            calls: [
              { tag: "Row", data: false },
              { tag: "Cell", data: false },
            ],
          },
          // Called only by the (kept) page: enclosed, so no boundary of its own.
          Row: { interactive: true, source: false },
          // Also passed as a value (unseen callers): not enclosed.
          Cell: { interactive: true, source: false },
        },
        {},
        null,
        { componentValues: ["Cell"] },
      ),
    ],
  ]);
  const out = boundaryFacts(facts, new Map());
  const v = (name: string) => out.verdicts.get("src/page.tsx")!.get(name)!;
  assert.deepEqual(out.boundaries("src/page.tsx"), ["Page", "Cell"]);
  assert.equal(v("Page").because, "live-props");
  assert.equal(v("Cell").because, "live-props");
  assert.equal(v("Row").interactive, false);
  assert.equal(v("Row").live, true);
  assert.equal(v("Row").adopted, true);
});

test("ORPHAN-B: a component handed a function (callback, signal) stays a boundary inside a boundary", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/demo.tsx",
      module({
        // Its own signal: a boundary (route root).
        Demo: {
          interactive: true,
          source: true,
          renders: ["Stepper", "Label"],
          calls: [
            // `currentStep={step} onStepChange={(i) => step.set(i)}`: behaviour handed in.
            { tag: "Stepper", data: false, fn: true },
            // `text={label()}`: plain live data.
            { tag: "Label", data: false },
          ],
        },
        Stepper: { interactive: true, source: false },
        Label: { interactive: true, source: false },
      }),
    ],
  ]);
  const out = boundaryFacts(facts, new Map(), new Set(["src/demo.tsx"]));
  assert.deepEqual(out.boundaries("src/demo.tsx"), ["Demo", "Stepper"]);
  assert.equal(out.verdicts.get("src/demo.tsx")!.get("Stepper")!.because, "live-props");
  assert.equal(out.verdicts.get("src/demo.tsx")!.get("Label")!.interactive, false);
  assert.equal(out.verdicts.get("src/demo.tsx")!.get("Label")!.live, true);
});

test("6b + ORPHAN-B: context readers follow their provider's liveness (enclosing elements and callers), no boundary", () => {
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
    assert.deepEqual(out.boundaries("src/meter.tsx"), [], String(live));
    assert.equal(out.verdicts.get("src/meter.tsx")!.get("MeterOutput")!.live, live, String(live));
    assert.equal(out.verdicts.get("src/meter.tsx")!.get("MeterRoot")!.live, live, String(live));
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

test("STATIC-ZERO T3: a component whose only source is a conditional handler is a conditional boundary (`listener`)", () => {
  const facts = new Map<string, ModuleFacts>([
    ["src/page.tsx", module({ Page: { renders: ["Chat"], calls: [{ tag: "Chat", data: true }] } }, { Chat: ["./chat", "Chat"] }, "Page")],
    ["src/chat.tsx", module({ Chat: { interactive: true, source: false, listens: true }, Mixed: { interactive: true, source: true, listens: true } })],
  ]);
  const resolved = new Map([["src/page.tsx", new Map([["./chat", "src/chat.tsx"]])]]);
  const out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]));
  const chat = out.verdicts.get("src/chat.tsx")!.get("Chat")!;
  assert.equal(chat.interactive, true);
  assert.equal(chat.live, true);
  assert.equal(chat.because, "listener");
  assert.deepEqual(out.conditional("src/chat.tsx"), ["Chat"]);
  // A source of its own wins: kept on every instance.
  assert.equal(out.verdicts.get("src/chat.tsx")!.get("Mixed")!.because, "source");
  // The route root renders it: a boundary, conditional too (ZERO C3: no source of its own — the server drops its record
  // unless the instance is live or a dependent boundary below keeps it; an independent child keeps no ancestor).
  assert.deepEqual(out.boundaries("src/page.tsx"), ["Page"]);
  assert.deepEqual(out.conditional("src/page.tsx"), ["Page"]);
});

test("ZERO A1: adopted = boundary, rendered by an adopted component, used as a value, or reached by unseen code", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/page.tsx",
      module(
        {
          Page: { renders: ["Card", "Static", "Island"], params: "none" },
          Static: { renders: ["Leaf"] },
          Leaf: {},
          Island: { renders: ["Inner"] },
          Inner: {},
          Orphan: {},
        },
        { Card: ["./card", "Card"] },
        "Page",
      ),
    ],
    ["src/card.tsx", module({ Card: { interactive: true, renders: ["Label"] }, Label: {}, Glyph: {} }, {}, null, { componentValues: ["Glyph"] })],
  ]);
  const resolved = new Map([["src/page.tsx", new Map([["./card", "src/card.tsx"]])]]);
  const v = (file: string, name: string) => out.verdicts.get(file)!.get(name)!;
  // A route root rendered by the router's `Root` (no resolved call site): adopted, and so everything it renders.
  let out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]));
  assert.equal(v("src/page.tsx", "Page").adopted, true);
  assert.equal(v("src/page.tsx", "Static").adopted, true);
  assert.deepEqual(out.static("src/page.tsx"), []);
  // The same root under a host that never adopts it (`shells`): only boundaries and what they render are adopted.
  out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]), new Set(["src/page.tsx"]));
  assert.equal(v("src/page.tsx", "Page").interactive, true, "renders a boundary");
  assert.equal(v("src/page.tsx", "Page").adopted, true);
  // Page is a boundary (it renders Card): what it renders is walked by its adopt run.
  assert.equal(v("src/page.tsx", "Static").adopted, true);
  assert.equal(v("src/card.tsx", "Label").adopted, true, "rendered by a boundary");
  assert.equal(v("src/card.tsx", "Glyph").adopted, true, "used as a value");
  assert.equal(v("src/page.tsx", "Orphan").adopted, true, "no resolved call site");
  // A shell root with no boundary below: nothing is adopted.
  const plain = new Map<string, ModuleFacts>([
    ["src/page.tsx", module({ Page: { renders: ["Static"], params: "none" }, Static: { renders: ["Leaf"] }, Leaf: {} }, {}, "Page")],
  ]);
  out = boundaryFacts(plain, new Map(), new Set(["src/page.tsx"]), new Set(["src/page.tsx"]));
  assert.deepEqual(out.static("src/page.tsx").sort(), ["Leaf", "Page", "Static"]);
  // `file#Name` shell entries name a component other than the default export.
  out = boundaryFacts(plain, new Map(), new Set(), new Set(["src/page.tsx#Page"]));
  assert.deepEqual(out.static("src/page.tsx").sort(), ["Leaf", "Page", "Static"]);
});

test("ZERO A1: a compound used as a value counts every part adopted", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/menu.tsx",
      module({ MenuRoot: {}, MenuItem: {}, Page: { renders: ["MenuRoot"], params: "none" } }, {}, "Page", {
        compounds: new Map([["Menu", { root: "MenuRoot", parts: new Map([["Item", "MenuItem"]]) }]]),
        componentValues: ["Menu"],
      }),
    ],
  ]);
  const out = boundaryFacts(facts, new Map(), new Set(["src/menu.tsx"]), new Set(["src/menu.tsx"]));
  assert.deepEqual(out.static("src/menu.tsx"), ["Page"]);
});

test("ZERO A1: adopted = boundary, rendered by an adopted component, used as a value, or reached by unseen code", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/page.tsx",
      module(
        {
          Page: { renders: ["Card", "Static", "Island"], params: "none" },
          Static: { renders: ["Leaf"] },
          Leaf: {},
          Island: { renders: ["Inner"] },
          Inner: {},
          Orphan: {},
        },
        { Card: ["./card", "Card"] },
        "Page",
      ),
    ],
    ["src/card.tsx", module({ Card: { interactive: true, renders: ["Label"] }, Label: {}, Glyph: {} }, {}, null, { componentValues: ["Glyph"] })],
  ]);
  const resolved = new Map([["src/page.tsx", new Map([["./card", "src/card.tsx"]])]]);
  const v = (file: string, name: string) => out.verdicts.get(file)!.get(name)!;
  // A route root rendered by the router's `Root` (no resolved call site): adopted, and so everything it renders.
  let out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]));
  assert.equal(v("src/page.tsx", "Page").adopted, true);
  assert.equal(v("src/page.tsx", "Static").adopted, true);
  assert.deepEqual(out.static("src/page.tsx"), []);
  // The same root under a host that never adopts it (`shells`): only boundaries and what they render are adopted.
  out = boundaryFacts(facts, resolved, new Set(["src/page.tsx"]), new Set(["src/page.tsx"]));
  assert.equal(v("src/page.tsx", "Page").interactive, true, "renders a boundary");
  assert.equal(v("src/page.tsx", "Page").adopted, true);
  // Page is a boundary (it renders Card): what it renders is walked by its adopt run.
  assert.equal(v("src/page.tsx", "Static").adopted, true);
  assert.equal(v("src/card.tsx", "Label").adopted, true, "rendered by a boundary");
  assert.equal(v("src/card.tsx", "Glyph").adopted, true, "used as a value");
  assert.equal(v("src/page.tsx", "Orphan").adopted, true, "no resolved call site");
  // A shell root with no boundary below: nothing is adopted.
  const plain = new Map<string, ModuleFacts>([
    ["src/page.tsx", module({ Page: { renders: ["Static"], params: "none" }, Static: { renders: ["Leaf"] }, Leaf: {} }, {}, "Page")],
  ]);
  out = boundaryFacts(plain, new Map(), new Set(["src/page.tsx"]), new Set(["src/page.tsx"]));
  assert.deepEqual(out.static("src/page.tsx").sort(), ["Leaf", "Page", "Static"]);
  // `file#Name` shell entries name a component other than the default export.
  out = boundaryFacts(plain, new Map(), new Set(), new Set(["src/page.tsx#Page"]));
  assert.deepEqual(out.static("src/page.tsx").sort(), ["Leaf", "Page", "Static"]);
});

test("ZERO A1: a compound used as a value counts every part adopted", () => {
  const facts = new Map<string, ModuleFacts>([
    [
      "src/menu.tsx",
      module({ MenuRoot: {}, MenuItem: {}, Page: { renders: ["MenuRoot"], params: "none" } }, {}, "Page", {
        compounds: new Map([["Menu", { root: "MenuRoot", parts: new Map([["Item", "MenuItem"]]) }]]),
        componentValues: ["Menu"],
      }),
    ],
  ]);
  const out = boundaryFacts(facts, new Map(), new Set(["src/menu.tsx"]), new Set(["src/menu.tsx"]));
  assert.deepEqual(out.static("src/menu.tsx"), ["Page"]);
});

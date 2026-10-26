// ZERO STATESPACE: the per-call-site native automaton proof (`facts-native.ts`) over hand-built module facts (no wasm).
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { nativeFamilies, stylesState } from "../facts-native.ts";
import type { ComponentBoundaryFacts, ModuleFacts } from "../index.ts";

type Call = { tag: string; data?: boolean; fn?: boolean; around?: string[]; inputs?: boolean; attrs?: string[] };
type Component = Omit<Partial<ComponentBoundaryFacts>, "renders" | "calls"> & { calls?: Call[] };

function module(components: Record<string, Component>, imports: Record<string, [string, string]> = {}, extra: Partial<ModuleFacts> = {}): ModuleFacts {
  const boundaries = new Map<string, ComponentBoundaryFacts>();
  for (const [name, c] of Object.entries(components))
    boundaries.set(name, {
      interactive: c.interactive ?? false,
      source: c.source ?? false,
      provides: c.provides ?? false,
      listens: c.listens ?? false,
      context: c.context ?? false,
      params: c.params ?? "object",
      renders: new Set((c.calls ?? []).map((call) => call.tag)),
      calls: (c.calls ?? []).map((call) => ({ data: true, fn: false, around: [], inputs: call.data ?? true, attrs: [], ...call })),
    });
  return {
    imports: new Map(Object.entries(imports).map(([local, [from, imported]]) => [local, { from, imported }])),
    statics: new Set(Object.values(imports).map(([from]) => from)),
    dynamics: new Set(),
    components: new Map([...boundaries.keys()].map((name) => [name, new Set<string>()])),
    groups: [],
    preload: null,
    defaultName: null,
    exports: new Map([...boundaries.keys()].map((name) => [name, name])),
    reexports: new Map(),
    stars: [],
    compounds: new Map(),
    ...extra,
    boundaries,
  };
}

const UI = "ui/switch.tsx";
const PRAGMA = "// @rivet-native SwitchRoot(children,class,defaultSelected) SwitchContent(children,class) SwitchThumb(children)";
const family = () =>
  module(
    {
      // The root's shorthand renders its own parts (family code: no orphan).
      SwitchRoot: { context: true, calls: [{ tag: "SwitchContent" }, { tag: "SwitchThumb", around: ["SwitchContent"] }] },
      SwitchContent: { context: true },
      SwitchThumb: { context: true },
    },
    {},
    {
      exports: new Map(["SwitchRoot", "SwitchContent", "SwitchThumb", "Switch"].map((name) => [name, name])),
      compounds: new Map([
        [
          "Switch",
          {
            root: "SwitchRoot",
            parts: new Map([
              ["Content", "SwitchContent"],
              ["Thumb", "SwitchThumb"],
            ]),
          },
        ],
      ]),
    },
  );
const imports: Record<string, [string, string]> = { Switch: ["./switch", "Switch"], Icon: ["./icon", "Icon"] };
const icon = () => module({ Icon: {} });

function prove(page: Record<string, Component>, styled: string[] = [], pageExtra: Partial<ModuleFacts> = {}) {
  const facts = new Map<string, ModuleFacts>([
    // The page module's `Page` is a route root (static inputs: not live).
    ["app/page.tsx", module(page, imports, { defaultName: "Page", ...pageExtra })],
    [UI, family()],
    ["ui/icon.tsx", icon()],
  ]);
  const resolved = new Map([
    [
      "app/page.tsx",
      new Map([
        ["./switch", UI],
        ["./icon", "ui/icon.tsx"],
      ]),
    ],
  ]);
  const verdicts = boundaryFacts(facts, resolved, new Set(["app/page.tsx"]), new Set(), undefined, {
    families: new Map([[UI, nativeFamilies(PRAGMA)]]),
    stateStyled: new Set(styled),
  });
  return verdicts.native("app/page.tsx");
}

const site = (root: Partial<Call> = {}, content: Partial<Call> = {}, extra: Call[] = []): Component => ({
  calls: [
    { tag: "Switch", attrs: ["defaultSelected"], ...root },
    { tag: "Switch.Content", around: ["Switch"], attrs: ["class"], ...content },
    { tag: "Switch.Thumb", around: ["Switch.Content", "Switch"] },
    ...extra,
  ],
});

test("nativeFamilies parses the pragma: root first, per-part props", () => {
  const [f] = nativeFamilies(PRAGMA);
  assert.equal(f!.root, "SwitchRoot");
  assert.deepEqual([...f!.parts.keys()], ["SwitchRoot", "SwitchContent", "SwitchThumb"]);
  assert.deepEqual([...f!.parts.get("SwitchRoot")!], ["children", "class", "defaultSelected"]);
  assert.deepEqual(nativeFamilies("const x = 1;"), []);
});

test("a closed call site with declared data props is proven", () => {
  assert.deepEqual(prove({ Page: site() }), ["Page:0"]);
  // data-* / aria-* attributes are always allowed.
  assert.deepEqual(prove({ Page: site({ attrs: ["data-x", "aria-label"] }) }), ["Page:0"]);
});

test("escapes keep today's path: undeclared props, live values, spreads, functions, render props", () => {
  assert.deepEqual(prove({ Page: site({ attrs: ["onChange*"], fn: true }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["isSelected"] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["defaultSelected*"] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["..."] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["()"] }) }), []);
  assert.deepEqual(prove({ Page: site({}, { attrs: ["class*"] }) }), []);
  assert.deepEqual(prove({ Page: site({}, { fn: true }) }), []);
});

test("other components inside the root: static, context-free instances only", () => {
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch.Content", "Switch"] }]) }), ["Page:0"]);
  // Non-data inputs from a caller that is not live are static values.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch"], data: false, attrs: ["icon*"] }]) }), ["Page:0"]);
  // A function passed in, or an unresolved component: unknown.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch"], fn: true }]) }), []);
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Mystery", around: ["Switch"] }]) }), []);
  // An Icon outside the root does not matter.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", fn: true }]) }), ["Page:0"]);
});

test("a part outside any root (a wrapper) or used as a value makes the whole family unproven", () => {
  assert.deepEqual(prove({ Page: site(), Wrapper: { calls: [{ tag: "Switch.Content" }] } }), []);
  assert.deepEqual(prove({ Page: site() }, [], { componentValues: ["Switch"] }), []);
});

test("a caller module that styles component state (data-selected / aria-expanded selectors) stays unproven", () => {
  assert.deepEqual(prove({ Page: site() }, ["app/page.tsx"]), []);
  assert.equal(stylesState(`class="data-selected:bg-accent"`), true);
  assert.equal(stylesState(`class="group-data-[expanded=true]:rotate-180"`), true);
  assert.equal(stylesState(`class="[&:has([aria-expanded='true'])]:rounded-none"`), true);
  assert.equal(stylesState(`<li aria-checked={on() ? "true" : "false"} data-slot="switch">`), false);
});

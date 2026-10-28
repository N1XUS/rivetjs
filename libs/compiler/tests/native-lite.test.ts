// PRESS-LITE (`native-lite.ts`): the declaration, the handler proof, the per-site plan over real module facts (context
// proof from `facts-callsite.ts`) and the page scope.
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { placeCalls } from "../facts-placement.ts";
import { hasDerivedModel, moduleFacts, type ModuleFacts } from "../index.ts";
import { handlerIgnoresArguments, liteFamilies, liteModule, litePlan, type LiteElement } from "../native-lite.ts";

test("lite: declarations — plain, live, handler and literal props", () => {
  const [f, ...rest] = liteFamilies("// @rivet-native-lite Btn(children, variant,type=button,isDisabled*,onPress!) BtnLite(./btn-lite.tsx)\n");
  assert.equal(rest.length, 0);
  assert.equal(f!.root, "Btn");
  assert.equal(f!.lite, "BtnLite");
  assert.equal(f!.spec, "./btn-lite.tsx");
  assert.deepEqual(Object.fromEntries(f!.props), {
    children: { kind: "plain" },
    variant: { kind: "plain" },
    type: { kind: "literal", value: "button" },
    isDisabled: { kind: "live" },
    onPress: { kind: "handler" },
  });
  assert.deepEqual(liteFamilies("const a = 1; // @rivet-native-lite X(a) Y(./y.tsx)"), [], "a line comment of its own");
  assert.deepEqual(liteFamilies("// @rivet-native X(a)"), []);
});

const handler = (body: string, jsx = `<B onPress={h} />`): boolean => {
  const mod = liteModule(`${body}\nexport function C(props) { const local = 1; return ${jsx}; }`, "/m.tsx")!;
  const el = mod.elements.find((e) => e.tag === "B") as LiteElement;
  return handlerIgnoresArguments(el.attrs.get("onPress") ?? null, mod, el.start);
};

test("lite: handlers that never read their arguments", () => {
  // Inline.
  assert.ok(handler("", `<B onPress={() => go()} />`));
  assert.ok(handler("", `<B onPress={(e) => go()} />`), "an unused parameter");
  assert.ok(handler("", `<B onPress={async () => { await go(); }} />`));
  assert.ok(handler("", `<B onPress={function () { go(); }} />`));
  // Bindings: a const arrow, a function declaration (module or component scope).
  assert.ok(handler("const h = () => go();"));
  assert.ok(handler("function h() { go(); }"));
  assert.equal(handler(""), false, "unbound: a global");
  const inComponent = liteModule(`export function C() { const h = () => go(); return <B onPress={h} />; }`, "/m.tsx")!;
  const el = inComponent.elements[0]!;
  assert.ok(handlerIgnoresArguments(el.attrs.get("onPress")!, inComponent, el.start));
  // Each shape that reads the event or cannot be resolved.
  for (const [body, jsx] of [
    ["", `<B onPress={(e) => go(e)} />`],
    ["", `<B onPress={(e) => e.continuePropagation()} />`],
    ["", `<B onPress={({ pointerType }) => go(pointerType)} />`],
    ["", `<B onPress={(e = 1) => go()} />`],
    ["", `<B onPress={function () { go(arguments); }} />`],
    ["", `<B onPress={function () { this.x(); }} />`],
    ["", `<B onPress={function* () {}} />`],
    ["", `<B onPress={store.inc} />`],
    ["", `<B onPress={make()} />`],
    ["", `<B onPress="x" />`],
    ["const h = (e) => go(e);", `<B onPress={h} />`],
    ["let h = () => go();", `<B onPress={h} />`],
    ["function h() { go(); }\nh = other;", `<B onPress={h} />`],
    ["const h = () => 1;\nfunction other() { const h = (e) => e; }", `<B onPress={h} />`],
    ["const h = pick();", `<B onPress={h} />`],
  ])
    assert.equal(handler(body!, jsx), false, body + " " + jsx);
  // A binding in another component's scope does not reach this site.
  const other = liteModule(`function A() { const h = () => go(); }\nexport function C() { return <B onPress={h} />; }`, "/m.tsx")!;
  const o = other.elements[0]!;
  assert.equal(handlerIgnoresArguments(o.attrs.get("onPress")!, other, o.start), false);
});

const CTX = `import { createContext } from "@rivetjs/reactivity";
export const SlotCtx = createContext(null);
export const InnerCtx = createContext(null);
`;
const BTN = `import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { SlotCtx, InnerCtx } from "./ctx.ts";
import { Press } from "./press.tsx";
// @rivet-native-lite Btn(children,variant,type=button,isDisabled*,onPress!) BtnLite(./btn-lite.tsx)
export function Btn(props) {
  const slot = useContext(SlotCtx);
  return <Provider token={InnerCtx} value={1}><Press onPress={props.onPress}>{props.children}</Press></Provider>;
}
`;
const PRESS = `export function Press(props) { return <button onClick={props.onPress}>{props.children}</button>; }\n`;
const LITE = `export function BtnLite(props) { return <button onClick={props.onPress} disabled={props.isDisabled}>{props.children}</button>; }\n`;
const SLOTS = `import { Provider } from "@rivetjs/runtime/dom";
import { SlotCtx } from "./ctx.ts";
export function Slots(props) { return <Provider token={SlotCtx} value={{}}>{props.children}</Provider>; }
`;
const READER = `import { useContext } from "@rivetjs/reactivity";
import { InnerCtx } from "./ctx.ts";
export function Reader() { return <i>{String(useContext(InnerCtx))}</i>; }
`;
const ICON = `export function Icon(props) { return <svg data-name={props.name} />; }\n`;
const LIB: Record<string, string> = {
  "/l/ctx.ts": CTX,
  "/l/btn.tsx": BTN,
  "/l/press.tsx": PRESS,
  "/l/btn-lite.tsx": LITE,
  "/l/slots.tsx": SLOTS,
  "/l/reader.tsx": READER,
  "/l/icon.tsx": ICON,
};

function plan(pages: Record<string, string>, options: { scope?: boolean; trace?: unknown[][] } = {}) {
  const sources = { ...LIB, ...pages };
  const facts = new Map<string, ModuleFacts>();
  for (const [file, source] of Object.entries(sources))
    facts.set(
      file,
      file.endsWith(".tsx") ? placeCalls(source, file, moduleFacts(source, file, { boundaries: true, refs: true })) : moduleFacts(source, file, { refs: true }),
    );
  const graph = new Map<string, Map<string, string>>();
  for (const file of Object.keys(sources)) {
    const map = new Map<string, string>();
    for (const spec of [...facts.get(file)!.statics, ...facts.get(file)!.dynamics])
      if (spec.startsWith("./")) map.set(spec, file.slice(0, file.lastIndexOf("/") + 1) + spec.slice(2));
    for (const spec of [...facts.get(file)!.statics, ...facts.get(file)!.dynamics]) if (spec.startsWith("/l/")) map.set(spec, spec);
    graph.set(file, map);
  }
  const roots = new Set(Object.keys(pages).filter((f) => f.startsWith("/p/")));
  // The pages are shells (nothing above them: no route host), as docs frames.
  const verdicts = boundaryFacts(facts, graph, new Set(), roots, {
    external: (_file, spec) => (spec.startsWith("@rivetjs/") ? null : "pkg:" + spec),
    hosts: new Set(),
  });
  const proof = verdicts.callSites!;
  const edges = (kind: "statics" | "dynamics") => (file: string) => [...(facts.get(file)?.[kind] ?? [])].flatMap((spec) => graph.get(file)?.get(spec) ?? []);
  return litePlan({
    texts: new Map(Object.entries(sources)),
    facts,
    families: new Map([["/l/btn.tsx", liteFamilies(BTN)]]),
    stateStyled: new Set(Object.keys(pages).filter((f) => pages[f]!.includes("data-pressed"))),
    twin: (file, spec) => file.slice(0, file.lastIndexOf("/") + 1) + spec.slice(2),
    callers: verdicts.callers,
    aboveCall: verdicts.aboveCall,
    touches: (id) => proof.touches(id),
    provides: (id) => proof.provides(id),
    resolveTag: verdicts.resolveTag,
    ...(options.scope
      ? {
          pages: [...roots],
          edges: edges("statics"),
          dynamicEdges: edges("dynamics"),
          // `press.tsx` stands for the root's other-package dependency (ui Button's cdk modules).
          packageOf: (file: string) => (file === "/l/press.tsx" ? "/cdk" : file.startsWith("/l/") ? "/l" : null),
          isStatic: (id: string) => verdicts.static(id.slice(0, id.lastIndexOf("?"))).includes(id.slice(id.lastIndexOf("?") + 1)),
        }
      : {}),
    ...(options.trace ? { trace: (...a: unknown[]) => options.trace!.push(a) } : {}),
  });
}

test.skipIf(!hasDerivedModel())("lite: proven sites are renamed to the twin and import it; every other shape keeps the root", () => {
  const page = `import { signal } from "@rivetjs/reactivity";
import { Btn } from "/l/btn.tsx";
import { Slots } from "/l/slots.tsx";
import { Reader } from "/l/reader.tsx";
import { Icon } from "/l/icon.tsx";
export default function Page(props) {
  const n = signal(0);
  const add = () => n.set(n() + 1);
  return (
    <main>
      <Btn onPress={add}>a</Btn>
      <Btn variant="ghost" type="button" isDisabled={n() === 0} onPress={() => n.set(0)}>b <Icon name="x" /></Btn>
      <Btn onPress={(e) => n.set(e.x)}>c</Btn>
      <Btn variant={props.v} onPress={add}>d</Btn>
      <Btn class="x" onPress={add}>e</Btn>
      <Btn {...props} onPress={add}>f</Btn>
      <Btn type="submit" onPress={add}>g</Btn>
      <Btn onPress={add}>{() => "h"}</Btn>
      <Btn onPress={add}>{props.children}</Btn>
      <Btn onPress={add}><Reader /></Btn>
      <Slots><Btn onPress={add}>i</Btn></Slots>
      <Btn onPressStart={add}>j</Btn>
    </main>
  );
}
`;
  const trace: unknown[][] = [];
  const result = plan({ "/p/page.tsx": page }, { trace });
  assert.deepEqual(result.proven, ["/p/page.tsx?Page:0", "/p/page.tsx?Page:1"], JSON.stringify(trace));
  assert.deepEqual([...result.twins], ["/l/btn-lite.tsx"]);
  const out = result.texts.get("/p/page.tsx")!;
  assert.ok(out.startsWith(`import { BtnLite as RvLite$BtnLite } from "../l/btn-lite.tsx";import { signal }`));
  assert.equal(out.split("\n").length, page.split("\n").length, "same line count");
  assert.ok(out.includes(`<RvLite$BtnLite onPress={add}>a</RvLite$BtnLite>`));
  assert.ok(out.includes(`<RvLite$BtnLite variant="ghost" type="button" isDisabled={n() === 0} onPress={() => n.set(0)}>b <Icon name="x" /></RvLite$BtnLite>`));
  assert.equal(out.split("<Btn ").length - 1, 10, "the other ten keep the root");
  // Call indexes count every component element (`Icon` = 2, `Reader` = 11, `Slots` = 12).
  const why = (n: number) => trace.find((t) => t[1] === "Page:" + n)?.[2];
  assert.equal(why(3), "handler reads arguments");
  assert.equal(why(4), "attr");
  assert.equal(why(5), "attr");
  assert.equal(why(6), "attr");
  assert.equal(why(7), "not literal");
  assert.equal(why(8), "attr");
  assert.equal(why(9), "children from outside");
  assert.equal(why(10), "inner reads", "Reader reads the root's InnerCtx provision");
  assert.equal(why(13), "provided above", "Slots provides the root's SlotCtx");
  assert.equal(why(14), "attr");
});

test.skipIf(!hasDerivedModel())("lite: a module styling component state keeps the root", () => {
  const result = plan({
    "/p/page.tsx": `import { Btn } from "/l/btn.tsx";\nconst look = "[data-pressed]:scale-95";\nexport default function Page() { const go = () => 1; return <Btn onPress={go}>{look.length}</Btn>; }\n`,
  });
  assert.deepEqual(result.proven, []);
});

test.skipIf(!hasDerivedModel())("lite: page scope — a page that keeps the root's code (an unproven site, a foreign import) keeps its proven sites", () => {
  const pure = `import { Btn } from "/l/btn.tsx";\nexport default function Pure() { const go = () => 1; return <Btn onPress={go}>a</Btn>; }\n`;
  const shared = `import { Btn } from "/l/btn.tsx";\nexport function Shared() { const go = () => 1; return <Btn onPress={go}>s</Btn>; }\n`;
  const mixed = `import { Btn } from "/l/btn.tsx";\nimport { Shared } from "/l/shared.tsx";\nexport default function Mixed(props) { return <main><Shared /><Btn onPress={(e) => props.go(e)}>m</Btn></main>; }\n`;
  const foreign = `import { Press } from "/l/press.tsx";\nimport { Btn } from "/l/btn.tsx";\nexport default function Foreign() { const go = () => 1; return <main><Press /><Btn onPress={go}>f</Btn></main>; }\n`;
  const hub = `export const pages = { a: () => import("/p/lazy.tsx") };\nexport default function Hub() { return <i />; }\n`;
  const lazy = `import { Btn } from "/l/btn.tsx";\nexport default function Lazy() { const go = () => 1; return <Btn onPress={go}>l</Btn>; }\n`;
  const program = { "/l/shared.tsx": shared, "/p/pure.tsx": pure, "/p/mixed.tsx": mixed, "/p/foreign.tsx": foreign, "/p/hub.tsx": hub, "/p/lazy.tsx": lazy };
  const all = plan(program);
  assert.deepEqual(all.proven.sort(), ["/l/shared.tsx?Shared:0", "/p/foreign.tsx?Foreign:1", "/p/lazy.tsx?Lazy:0", "/p/pure.tsx?Pure:0"]);
  const scoped = plan(program, { scope: true });
  // Mixed keeps the root (its own site reads the event): Shared, on that page, stays; Foreign imports the root's
  // foreign dependency (`press.tsx`, another package); a dynamically imported unit is a page of its own.
  assert.deepEqual(scoped.proven.sort(), ["/p/lazy.tsx?Lazy:0", "/p/pure.tsx?Pure:0"]);
});

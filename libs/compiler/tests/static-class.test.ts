// VCLS (`static-class.ts`): the declaration, the per-element proof, the program plan (proven sites get `$cls`, every
// shape that can create an instance without it flags its module) and the browser rewrite of the declaring module.
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { hasDerivedModel, moduleFacts, type ModuleFacts } from "../index.ts";
import {
  classFamilies,
  classModule,
  classPlan,
  effectSource,
  lazyResolvers,
  provenProps,
  sideEffectImports,
  type ClassElement,
  type ClassPlanInput,
} from "../static-class.ts";

test("static class: declarations", () => {
  assert.deepEqual(
    classFamilies("// @rivet-class ButtonRoot(fullWidth, size,variant) buttonVariants with(ButtonGroupContext)\n// @rivet-class Chip(color) chipVariants"),
    [
      { component: "ButtonRoot", keys: ["fullWidth", "size", "variant"], resolver: "buttonVariants", with: ["ButtonGroupContext"] },
      { component: "Chip", keys: ["color"], resolver: "chipVariants", with: [] },
    ],
  );
  assert.deepEqual(classFamilies("const a = 1; // @rivet-class X(a) b"), [], "a line comment of its own");
});

const element = (jsx: string): ClassElement => {
  const mod = classModule(`export function C() { const x = 1; return ${jsx}; }`, "/m.tsx");
  assert.ok(mod);
  return mod.elements[0]!;
};

test("static class: proven props — constants and absent keys only, no override, no spread", () => {
  const keys = ["variant", "size", "fullWidth"];
  assert.deepEqual(provenProps(element(`<B variant="ghost" fullWidth onPress={x} isDisabled={x > 0}>t</B>`), keys), { variant: "ghost", fullWidth: true });
  assert.deepEqual(provenProps(element(`<B variant={"a"} size={\`sm\`} fullWidth={false} />`), keys), { variant: "a", size: "sm", fullWidth: false });
  assert.deepEqual(provenProps(element(`<B />`), keys), {});
  // Each shape that disproves the site.
  for (const jsx of [
    `<B variant={x} />`,
    `<B variant={x ? "a" : "b"} />`,
    `<B variant={\`\${x}\`} />`,
    `<B variant={undefined} />`,
    `<B {...x} variant="a" />`,
    `<B class="w-full" />`,
    `<B className="w-full" />`,
    `<B variant="a" variant="b" />`,
    `<B $cls="x" />`,
  ])
    assert.equal(provenProps(element(jsx), keys), null, jsx);
});

test("static class: module parse — elements in order with enclosing tags, values read", () => {
  const mod = classModule(
    `import { B, G } from "./b.tsx";
const Alias = B;
export const table = { b: B };
export function C(props) {
  call(B.Root);
  return <G><B variant="a" /><B.Root /></G>;
}
export { B };
type T = typeof B;`,
    "/m.tsx",
  )!;
  assert.deepEqual(
    mod.elements.map((e) => [e.component, e.tag, e.ordinal, e.around]),
    [
      ["C", "G", 0, []],
      ["C", "B", 0, ["G"]],
      ["C", "B.Root", 0, ["G"]],
    ],
  );
  assert.ok(mod.values.has("B") && mod.values.has("call") && !mod.values.has("T") && !mod.values.has("Alias") && !mod.values.has("table"));
  assert.ok(!classModule(`export function C() { return <B variant="a" />; }\nexport { B } from "./b.tsx";`, "/m.tsx")!.values.has("B"), "exports are no use");
  assert.ok(classModule(`const m = import(spec);`, "/m.ts")!.dynamicAny);
  assert.ok(!classModule(`const m = import("./b.tsx");`, "/m.ts")!.dynamicAny);
  // A compound declaration reads its root, but that is the compound itself (its uses count).
  assert.ok(!classModule(`import { R } from "./r.tsx";\nexport const B = Object.assign(R, { Root: R });`, "/i.ts", new Set(["B"]))!.values.has("R"));
});

test("static class: browser rewrite of the declaring module", () => {
  const code = `import { a } from "x";\nimport { buttonVariants, other } from "./styles.ts";\nexport const f = () => buttonVariants({});\n`;
  const out = lazyResolvers(code, new Map([["buttonVariants", "k1"]]))!;
  assert.equal(
    out,
    `import { lazy as __rvClassLazy } from "rivet-class-registry";import { a } from "x";\nimport { other } from "./styles.ts";import "rivet-class-fx:k1";const buttonVariants = /* @__PURE__ */ __rvClassLazy("k1");\nexport const f = () => buttonVariants({});\n`,
  );
  assert.equal(out.split("\n").length, code.split("\n").length, "same line count");
  assert.equal(lazyResolvers(code, new Map([["missing", "k"]])), null);
  assert.deepEqual(
    sideEffectImports(
      `import "./a.css";\nimport { tv } from "./tv.ts";\nexport * from "./b.ts";\nexport { x } from "./c.ts";\nexport type { T } from "./t.ts";`,
      "/d.ts",
    ),
    {
      bare: ["./a.css"],
      follow: ["./b.ts", "./c.ts"],
    },
  );
});

// A small program: the declaring module, its definition and context modules, and callers of every shape.
const PROGRAM: Record<string, string> = {
  "/p/btn.tsx": `import { btnVariants } from "./btn.styles.ts";
import { GroupCtx } from "./ctx.ts";
import { useContext } from "@rivetjs/reactivity";
// @rivet-class Btn(variant,size) btnVariants with(GroupCtx)
export function Btn(props) {
  const g = useContext(GroupCtx);
  return <button class={props.$cls ?? btnVariants({ variant: props.variant, size: props.size })}>{props.children}</button>;
}
`,
  "/p/btn.styles.ts": `export const btnVariants = (p) => "btn btn--" + (p.variant ?? "primary") + "-" + (p.size ?? "md");\n`,
  "/p/ctx.ts": `import { createContext } from "@rivetjs/reactivity";\nexport const GroupCtx = createContext({});\nexport const OTHER = 1;\n`,
  "/p/index.ts": `import { Btn } from "./btn.tsx";\nexport const Button = Object.assign(Btn, { Root: Btn });\nexport { GroupCtx, OTHER } from "./ctx.ts";\n`,
  "/p/proven.tsx": `import { Button } from "./index.ts";\nimport { OTHER } from "./index.ts";\nexport default function Page() {\n  return <main><Button variant="ghost" onClick={() => 1}>a</Button><Button.Root size="sm">b</Button.Root></main>;\n}\n`,
  "/p/dynamic.tsx": `import { Button } from "./index.ts";\nexport default function Page(props) {\n  return <main><Button variant="ghost">a</Button><Button variant={props.v}>b</Button></main>;\n}\n`,
  "/p/value.tsx": `import { Button } from "./index.ts";\nexport const map = { b: Button };\nexport default function Page() {\n  return <i />;\n}\n`,
  "/p/group.tsx": `import { GroupCtx } from "./index.ts";\nimport { Provider } from "@rivetjs/runtime/dom";\nexport default function Group(props) {\n  return <Provider token={GroupCtx} value={{ variant: "x" }}>{props.children}</Provider>;\n}\n`,
  "/p/ns.tsx": `import * as UI from "./index.ts";\nexport default function Page() {\n  return <main><UI.Button variant="a">x</UI.Button>{String(UI)}</main>;\n}\n`,
  "/p/lazy.tsx": `export default function Page() {\n  const m = import("./index.ts");\n  return <i>{String(m)}</i>;\n}\n`,
  "/p/helper.tsx": `import { Button } from "./index.ts";\nfunction row() {\n  return <Button variant="a">x</Button>;\n}\nexport default function Page() {\n  return <i>{row()}</i>;\n}\n`,
  "/p/hidden.tsx": `import { Button } from "./index.ts";\nexport const el = <Button variant="a">x</Button>;\nexport default function Page() {\n  return <i />;\n}\n`,
};
const IMPORTS: Record<string, Record<string, string>> = {
  "/p/btn.tsx": { "./btn.styles.ts": "/p/btn.styles.ts", "./ctx.ts": "/p/ctx.ts" },
  "/p/index.ts": { "./btn.tsx": "/p/btn.tsx", "./ctx.ts": "/p/ctx.ts" },
};

async function plan(
  program: Record<string, string>,
  scope: "build" | "page" = "page",
  extra: Record<string, Record<string, string>> = {},
  ships = false,
  rewrites: Pick<ClassPlanInput, "introduced" | "previouslyActive"> = {},
) {
  const facts = new Map<string, ModuleFacts>();
  const graph = new Map<string, Map<string, string>>();
  for (const [file, source] of Object.entries(program)) {
    facts.set(file, moduleFacts(source, file, file.endsWith(".tsx") ? { boundaries: true, refs: true } : { refs: true }));
    graph.set(file, new Map(Object.entries(extra[file] ?? IMPORTS[file] ?? { "./index.ts": "/p/index.ts" })));
  }
  const roots = new Set(Object.keys(program).filter((f) => !["/p/btn.tsx", "/p/index.ts", "/p/ctx.ts", "/p/btn.styles.ts"].includes(f)));
  const verdicts = boundaryFacts(facts, graph, roots);
  const evaluated: unknown[] = [];
  const result = await classPlan({
    ...rewrites,
    texts: new Map(Object.entries(program)),
    facts,
    target: (file, spec) => graph.get(file)?.get(spec) ?? null,
    resolveTag: verdicts.resolveTag,
    namespaceOf: verdicts.namespaceOf,
    exportsComponent: verdicts.exportsComponent,
    callers: verdicts.callers,
    definition: async (file, spec) => graph.get(file)?.get(spec) ?? null,
    evaluate: async (file, name, props) => {
      evaluated.push([file, name, props]);
      return "btn btn--" + (props.variant ?? "primary") + "-" + (props.size ?? "md");
    },
    keyOf: (file, name) => file + "#" + name,
    scope,
    ...(ships ? { boundaries: verdicts.boundaries, edges: (file: string) => graph.get(file)?.values() ?? [] } : {}),
  });
  return { result, evaluated };
}

test.skipIf(!hasDerivedModel())("static class: program plan — proven sites get $cls, every other way to an instance flags its module", async () => {
  const { result, evaluated } = await plan(PROGRAM);
  assert.deepEqual(
    result.families.map((f) => [f.file, f.component, f.key, f.proven]),
    [["/p/btn.tsx", "Btn", "/p/btn.styles.ts#btnVariants", 4]],
  );
  // proven.tsx ×2, dynamic.tsx's first Button, ns.tsx's `<UI.Button>` (its module is flagged for `String(UI)` all the same).
  assert.deepEqual(
    evaluated.map((e) => JSON.stringify(e)).sort(),
    [{ variant: "ghost" }, { size: "sm" }, { variant: "ghost" }, { variant: "a" }].map((p) => JSON.stringify(["/p/btn.styles.ts", "btnVariants", p])).sort(),
  );
  assert.equal(
    result.texts.get("/p/proven.tsx"),
    PROGRAM["/p/proven.tsx"]!.replace(`<Button variant`, `<Button $cls={"btn btn--ghost-md"} variant`).replace(
      `<Button.Root size`,
      `<Button.Root $cls={"btn btn--primary-sm"} size`,
    ),
  );
  assert.ok(result.texts.get("/p/dynamic.tsx")!.includes(`<Button $cls={"btn btn--ghost-md"} variant="ghost">a</Button><Button variant={props.v}>`));
  assert.deepEqual(
    [...result.flags.keys()].sort(),
    ["/p/dynamic.tsx", "/p/group.tsx", "/p/helper.tsx", "/p/hidden.tsx", "/p/lazy.tsx", "/p/ns.tsx", "/p/value.tsx"],
    "unproven site, context provider, JSX in a helper / outside a component, dynamic import, namespace value, value use",
  );
  assert.ok(!result.flags.has("/p/proven.tsx") && !result.flags.has("/p/index.ts") && !result.flags.has("/p/btn.tsx"));
});

test.skipIf(!hasDerivedModel())("static class: a family whose own module is flagged, or without a proven site, stays as today", async () => {
  const own = { ...PROGRAM, "/p/btn.tsx": PROGRAM["/p/btn.tsx"]! + "export const Self = () => <Btn variant={String(1)} />;\n" };
  const flagged = await plan(own);
  assert.deepEqual(flagged.result.families, []);
  assert.equal(flagged.result.texts.size, 0);
  assert.equal(flagged.result.flags.size, 0);
  const none = await plan({
    ...PROGRAM,
    "/p/proven.tsx": PROGRAM["/p/dynamic.tsx"]!.replace(`<Button variant="ghost">a</Button>`, ""),
    "/p/dynamic.tsx": "export default function P() { return <i />; }\n",
    "/p/ns.tsx": "export default function P() { return <i />; }\n",
  });
  assert.deepEqual(none.result.families, []);
});

test.skipIf(!hasDerivedModel())("static class: build scope — active only when no module needs the registration; a shared runtime stays reachable", async () => {
  const mixed = await plan(PROGRAM, "build");
  assert.deepEqual(mixed.result.families, [], "one flagged module keeps today's code for the whole build");
  assert.equal(mixed.result.texts.size, 0);
  assert.equal(mixed.result.flags.size, 0);
  const trivial = "export default function P() { return <i />; }\n";
  const clean = Object.fromEntries(
    Object.entries(PROGRAM).map(([file, source]) =>
      ["/p/dynamic.tsx", "/p/group.tsx", "/p/helper.tsx", "/p/hidden.tsx", "/p/lazy.tsx", "/p/ns.tsx", "/p/value.tsx"].includes(file)
        ? [file, trivial]
        : [file, source],
    ),
  );
  const proven = await plan(clean, "build");
  assert.deepEqual(
    proven.result.families.map((f) => [f.component, f.proven]),
    [["Btn", 2]],
  );
  assert.equal(proven.result.flags.size, 0);
  assert.ok(proven.result.texts.get("/p/proven.tsx")!.includes(`$cls={"btn btn--ghost-md"}`));
  // The definition's runtime (`rt`) imported by a sibling definition: it stays, so the family stays as today.
  const runtime = {
    ...clean,
    "/p/rt.ts": `export const rt = (p) => "btn btn--" + (p.variant ?? "primary") + "-" + (p.size ?? "md");\n`,
    "/p/btn.styles.ts": `import { rt } from "./rt.ts";\nexport const btnVariants = (p) => rt(p);\n`,
  };
  const edges = { "/p/btn.styles.ts": { "./rt.ts": "/p/rt.ts" }, "/p/chip.styles.ts": { "./rt.ts": "/p/rt.ts" } };
  const keepOf = async (...args: Parameters<typeof plan>) => (await plan(...args)).result.families.map((f) => f.keep);
  const RT = [{ file: "/p/rt.ts", name: "rt" }];
  assert.deepEqual(await keepOf(runtime, "build", edges), [[]], "runtime used by the definition only: it leaves too");
  const unused = { ...runtime, "/p/chip.styles.ts": `import { rt } from "./rt.ts";\nexport const chip = (p) => rt(p);\n` };
  assert.deepEqual(await keepOf(unused, "build", edges), [[]], "a sibling nobody imports (walked through a barrel) is tree-shaken");
  const sibling = { ...unused, "/p/chip.tsx": `import { chip } from "./chip.styles.ts";\nexport const Chip = () => <i class={chip({})} />;\n` };
  const siblingEdges = { ...edges, "/p/chip.tsx": { "./chip.styles.ts": "/p/chip.styles.ts" } };
  assert.deepEqual(await keepOf(sibling, "build", siblingEdges), [RT], "runtime shared with a used sibling: kept reachable");
  assert.deepEqual(await keepOf(sibling, "page", siblingEdges), [[]], "page scope drops it");
  assert.deepEqual(
    await keepOf(sibling, "build", siblingEdges, false, { introduced: new Set(["/p/btn.tsx"]) }),
    [[]],
    "a new twin does not retain an unused runtime merely to preserve a layout it never had",
  );
  // With the boundary hooks: a sibling reached only from modules without interactive boundaries (a static route) ships nothing.
  const page = { ...sibling, "/p/static.tsx": `import { Chip } from "./chip.tsx";\nexport default function S() { return <Chip />; }\n` };
  const pageEdges = { ...siblingEdges, "/p/static.tsx": { "./chip.tsx": "/p/chip.tsx" } };
  assert.deepEqual(await keepOf(page, "build", pageEdges, true), [[]], "static sibling: the runtime leaves");
  const live = {
    ...page,
    "/p/chip.tsx": `import { signal } from "@rivetjs/reactivity";\nimport { chip } from "./chip.styles.ts";\nexport const Chip = () => { const n = signal(0); return <i class={chip({})} onClick={() => n.set(1)}>{n()}</i>; };\n`,
  };
  assert.deepEqual(await keepOf(live, "build", pageEdges, true), [RT], "interactive sibling: kept");
});

test("static class: effect module — stylesheet imports, a kept runtime registered (a side effect the bundler keeps)", () => {
  assert.equal(effectSource(["/x/button.css"], []), 'import "/x/button.css";\n');
  assert.equal(
    effectSource(
      ["/x/button.css"],
      [
        { file: "/x/tv.ts", name: "tv" },
        { file: "/x/ns.ts", name: "*" },
      ],
    ),
    'import "/x/button.css";\nimport { register as __rvClassKeep } from "rivet-class-registry";\nimport { tv as __k0 } from "/x/tv.ts";\nimport * as __k1 from "/x/ns.ts";\n__rvClassKeep("", [__k0, __k1]);\n',
  );
});

test.skipIf(!hasDerivedModel())("static class: removing the last caller retains a prior proof, but every current flag still vetoes it", async () => {
  const declarations = Object.fromEntries(
    Object.entries(PROGRAM).filter(([file]) => ["/p/btn.tsx", "/p/btn.styles.ts", "/p/ctx.ts", "/p/index.ts"].includes(file)),
  );
  const rewrites = { previouslyActive: new Set(["/p/btn.tsx?Btn"]) };
  assert.deepEqual((await plan(declarations, "build")).result.families, [], "no prior proof: unchanged policy");
  const retained = await plan(declarations, "build", {}, false, rewrites);
  assert.equal(retained.result.families.length, 1);
  assert.equal(retained.result.families[0]!.proven, 0);
  assert.equal(retained.result.texts.size, 0, "no invented call-site class");
  for (const file of ["/p/dynamic.tsx", "/p/value.tsx", "/p/group.tsx", "/p/ns.tsx", "/p/lazy.tsx", "/p/helper.tsx", "/p/hidden.tsx"]) {
    const current = await plan({ ...declarations, [file]: PROGRAM[file]! }, "build", {}, false, rewrites);
    assert.deepEqual(current.result.families, [], file + ": a prior proof never overrides a current unsafe use");
  }
});

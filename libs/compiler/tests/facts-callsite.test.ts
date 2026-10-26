// ZERO CALLSITE: the per-call-site context proof (`facts-callsite.ts`) over real module facts (`moduleFacts(…, { refs })`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { moduleFacts, type ModuleFacts } from "../index.ts";

const CTX = `import { createContext, useContext } from "@rivetjs/reactivity";
export const ThemeContext = createContext("light");
export const SizeContext = createContext("md");
export function useTheme() { return useContext(ThemeContext); }`;

// A dependent part (reads a context: \`useContext\` in its body), a part reading one through a hook (the component facts
// do not see it: independent), an independent counter (no context).
const PARTS = `import { signal, useContext } from "@rivetjs/reactivity";
import { ThemeContext, useTheme } from "./ctx.tsx";
export function Part(props: { label: string }) {
  const theme = useContext(ThemeContext);
  const n = signal(0);
  return <button class={theme} onClick={() => n.set(n() + 1)}>{props.label}{n()}</button>;
}
export function HookPart(props: { label: string }) {
  const theme = useTheme();
  const n = signal(0);
  return <button class={theme} onClick={() => n.set(n() + 1)}>{props.label}{n()}</button>;
}
export function Counter(props: { start: number }) {
  const n = signal(props.start);
  return <button onClick={() => n.set(n() + 1)}>{n()}</button>;
}`;

function app(page: string, extra: Record<string, string> = {}) {
  const sources: Record<string, string> = { "src/ctx.tsx": CTX, "src/parts.tsx": PARTS, "src/page.tsx": page, ...extra };
  const facts = new Map<string, ModuleFacts>();
  for (const [file, source] of Object.entries(sources)) facts.set(file, moduleFacts(source, file, { boundaries: true, refs: true }));
  const resolved = new Map<string, Map<string, string>>();
  for (const file of Object.keys(sources)) {
    const map = new Map<string, string>();
    for (const [, { from }] of facts.get(file)!.imports) if (from.startsWith("./")) map.set(from, "src/" + from.slice(2));
    resolved.set(file, map);
  }
  return boundaryFacts(facts, resolved, new Set(), new Set(["src/page.tsx"]), {
    external: (_file, spec) => (spec.startsWith("@rivetjs/") ? null : "pkg:" + spec),
    hosts: new Set(),
  });
}

test("a site with no provider above it is proven: the dependent part is independent there (`site` / `sites`)", () => {
  const out = app(`import { Part } from "./parts.tsx";
export default function Demo() { return <div><Part label="a" /></div>; }`);
  assert.equal(out.verdicts.get("src/parts.tsx")!.get("Part")!.dependentBecause, "context");
  assert.deepEqual(out.callSites!.site("src/parts.tsx"), ["Part"]);
  assert.deepEqual(out.callSites!.sites("src/page.tsx"), ["Demo:0"]);
});

test("a provider of a token the part reads, above the site, keeps it dependent (caller code / enclosing component / up)", () => {
  // The caller provides it.
  let out = app(`import { provide } from "@rivetjs/reactivity";
import { Part } from "./parts.tsx";
import { ThemeContext } from "./ctx.tsx";
export default function Demo() { return provide(ThemeContext, "dark", () => <div><Part label="a" /></div>); }`);
  assert.deepEqual(out.callSites!.sites("src/page.tsx"), []);
  assert.deepEqual(out.callSites!.trace.get("src/parts.tsx?Part"), ["overlap"]);
  // An enclosing component provides it.
  out = app(
    `import { Part } from "./parts.tsx";
import { Themed } from "./themed.tsx";
export default function Demo() { return <Themed><Part label="a" /></Themed>; }`,
    {
      "src/themed.tsx": `import { provide } from "@rivetjs/reactivity";
import { ThemeContext } from "./ctx.tsx";
export function Themed(props: { children?: unknown }) { return provide(ThemeContext, "dark", () => <section>{props.children as never}</section>); }`,
    },
  );
  assert.deepEqual(out.callSites!.sites("src/page.tsx"), []);
  // A caller of the caller provides it (above, through the fixpoint).
  out = app(
    `import { Wrap } from "./wrap.tsx";
import { provide } from "@rivetjs/reactivity";
import { ThemeContext } from "./ctx.tsx";
export default function Demo() { return provide(ThemeContext, "dark", () => <Wrap />); }`,
    {
      "src/wrap.tsx": `import { Part } from "./parts.tsx";
export function Wrap() { return <div><Part label="a" /></div>; }`,
    },
  );
  assert.deepEqual(out.callSites!.sites("src/wrap.tsx"), []);
});

test("reading a token is no provision: a caller that reads it (`useContext`) still proves the site", () => {
  const out = app(`import { Part } from "./parts.tsx";
import { useTheme } from "./ctx.tsx";
export default function Demo() { const t = useTheme(); return <div class={t}><Part label="a" /></div>; }`);
  assert.deepEqual(out.callSites!.sites("src/page.tsx"), ["Demo:0"]);
});

test("a provider of another token does not overlap; a non-data call and an unknown enclosing tag do not prove", () => {
  let out = app(`import { provide } from "@rivetjs/reactivity";
import { Part } from "./parts.tsx";
import { SizeContext } from "./ctx.tsx";
export default function Demo() { return provide(SizeContext, "lg", () => <div><Part label="a" /></div>); }`);
  assert.deepEqual(out.callSites!.sites("src/page.tsx"), ["Demo:0"]);
  out = app(`import { Part } from "./parts.tsx";
export default function Demo() { return <div><Part label="a" onX={() => 1} /></div>; }`);
  assert.deepEqual(out.callSites!.trace.get("src/parts.tsx?Part"), ["not-data"]);
  out = app(`import { Part } from "./parts.tsx";
import { Box } from "some-ui";
export default function Demo() { return <Box><Part label="a" /></Box>; }`);
  assert.deepEqual(out.callSites!.trace.get("src/parts.tsx?Part"), ["above-top"]);
});

test("an independent component whose every site is proven is `free`; code the graph cannot follow is TOP", () => {
  let out = app(`import { Counter } from "./parts.tsx";
export default function Demo() { return <div><Counter start={1} /><Counter start={2} /></div>; }`);
  assert.deepEqual(out.independent("src/parts.tsx"), ["Counter"]);
  assert.deepEqual(out.callSites!.free("src/parts.tsx"), ["Counter"]);
  out = app(
    `import { Counter } from "./parts.tsx";
export default function Demo() { return <div><Counter start={1} /></div>; }`,
    {
      "src/parts.tsx": PARTS.replace("const n = signal(props.start);", 'const n = signal(props.start); import("./" + props.start);'),
    },
  );
  assert.deepEqual(out.callSites!.free("src/parts.tsx"), []);
  assert.deepEqual(out.callSites!.trace.get("src/parts.tsx?Counter"), ["touch-top"]);
});

test("a part reading a context through a hook (independent by the component facts) is `free` only without its provider above", () => {
  let out = app(`import { HookPart } from "./parts.tsx";
export default function Demo() { return <div><HookPart label="a" /></div>; }`);
  assert.deepEqual(out.independent("src/parts.tsx"), ["HookPart"]);
  assert.deepEqual(out.callSites!.free("src/parts.tsx"), ["HookPart"]);
  out = app(`import { provide } from "@rivetjs/reactivity";
import { HookPart } from "./parts.tsx";
import { ThemeContext } from "./ctx.tsx";
export default function Demo() { return provide(ThemeContext, "dark", () => <div><HookPart label="a" /></div>); }`);
  assert.deepEqual(out.callSites!.free("src/parts.tsx"), []);
});

test("RT-DIET2: a route module's `above` is what the route hosts provide (walked without the pages they load), not TOP", () => {
  const sources: Record<string, string> = {
    "src/ctx.tsx": CTX,
    "src/parts.tsx": PARTS,
    "src/page.tsx": `import { HookPart } from "./parts.tsx";
export default function Index() { return <div><HookPart label="a" /></div>; }`,
  };
  const run = (app: string, routeHosts: boolean) => {
    const all = { ...sources, "src/app.tsx": app };
    const facts = new Map<string, ModuleFacts>();
    for (const [file, source] of Object.entries(all)) facts.set(file, moduleFacts(source, file, { boundaries: true, refs: true }));
    const resolved = new Map<string, Map<string, string>>();
    for (const file of Object.keys(all)) {
      const map = new Map<string, string>();
      for (const [, { from }] of facts.get(file)!.imports) if (from.startsWith("./")) map.set(from, "src/" + from.slice(2));
      resolved.set(file, map);
    }
    return boundaryFacts(facts, resolved, new Set(["src/page.tsx", "src/app.tsx"]), new Set(), {
      external: (_file, spec) => (spec.startsWith("@rivetjs/") ? null : "pkg:" + spec),
      hosts: new Set(),
      ...(routeHosts ? { routeHosts: new Set(["src/app.tsx"]) } : {}),
    }).callSites!;
  };
  // The host loads the page (`import()`): what the page provides sits below it, not above.
  const plain = `export default function App(props: { children: unknown }) { return <body>{props.children}</body>; }
export const load = () => import("./page.tsx");`;
  const provides = `import { provide } from "@rivetjs/reactivity";
import { ThemeContext } from "./ctx.tsx";
export default function App(props: { children: unknown }) { return provide(ThemeContext, "dark", () => <body>{props.children}</body>); }
export const load = () => import("./page.tsx");`;
  let out = run(plain, false);
  assert.deepEqual(out.free("src/parts.tsx"), []);
  assert.deepEqual(out.trace.get("src/parts.tsx?HookPart"), ["above-top"]);
  out = run(plain, true);
  assert.deepEqual(out.free("src/parts.tsx"), ["HookPart"]);
  out = run(provides, true);
  assert.deepEqual(out.free("src/parts.tsx"), []);
  assert.deepEqual(out.trace.get("src/parts.tsx?HookPart"), ["overlap"]);
});

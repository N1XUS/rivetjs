// JS-DIET-2 C1: a call forwarding its caller's props (`<App data={props.data} />`) passes data when the caller's props are
// static (a derived root of a build without route roots, or a caller every site of which passes data / forwards so).
import { test } from "vitest";
import assert from "node:assert/strict";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { placeCalls } from "../facts-placement.ts";
import { moduleFacts, type ModuleFacts } from "../index.ts";

const PAGE = `import { signal } from "@rivetjs/reactivity";
export function App(props: { data: number[] }) {
  const n = signal(0);
  return <button onClick={() => n.set(n() + 1)}>{props.data.length}{n()}</button>;
}`;

function run(root: string, options: { roots?: string[]; extra?: Record<string, string>; routeHosts?: boolean } = {}) {
  const sources: Record<string, string> = { "src/page.tsx": PAGE, "src/root.tsx": root, ...options.extra };
  const facts = new Map<string, ModuleFacts>();
  for (const [file, source] of Object.entries(sources)) facts.set(file, placeCalls(source, file, moduleFacts(source, file, { boundaries: true, refs: true })));
  const resolved = new Map<string, Map<string, string>>();
  for (const file of Object.keys(sources)) {
    const map = new Map<string, string>();
    for (const [, { from }] of facts.get(file)!.imports) if (from.startsWith("./")) map.set(from, "src/" + from.slice(2));
    resolved.set(file, map);
  }
  const roots = new Set(options.roots ?? ["src/root.tsx"]);
  return boundaryFacts(facts, resolved, roots, new Set(), {
    external: (_file, spec) => (spec.startsWith("@rivetjs/") ? null : "pkg:" + spec),
    ...(options.routeHosts === false ? {} : { routeHosts: new Set(["src/root.tsx"]) }),
  });
}

const ROOT = `import { App } from "./page.tsx";
export default function Root(props: { data: number[] }) { return <App data={props.data} />; }`;

test("a derived root forwarding its data: the callee is independent and free, the root conditional", () => {
  const out = run(ROOT);
  assert.equal(out.verdicts.get("src/root.tsx")!.get("Root")!.conditional, true);
  const app = out.verdicts.get("src/page.tsx")!.get("App")!;
  assert.equal(app.independent, true);
  assert.deepEqual(out.independent("src/page.tsx"), ["App"]);
  assert.deepEqual(out.callSites!.free("src/page.tsx"), ["App"]);
  assert.equal(out.verdicts.get("src/root.tsx")!.get("Root")!.independent, true);
});

test("forwarding chains through a data-only middle component", () => {
  const out = run(
    `import { Mid } from "./mid.tsx";
export default function Root(props: { data: number[] }) { return <Mid rows={props.data} />; }`,
    {
      extra: {
        "src/mid.tsx": `import { App } from "./page.tsx";\nexport function Mid(props: { rows: number[] }) { return <section><App data={props.rows} /></section>; }`,
      },
    },
  );
  assert.equal(out.verdicts.get("src/page.tsx")!.get("App")!.independent, true);
});

test("not proven: no derived roots, route roots present, rebinding, optional chains, children, spreads, calls", () => {
  const dependent = (out: ReturnType<typeof run>) => assert.equal(out.verdicts.get("src/page.tsx")!.get("App")!.dependentBecause, "call-site");
  dependent(run(ROOT, { routeHosts: false }));
  // A route root in the build: derived roots may sit under the router's layouts.
  dependent(
    run(ROOT, { roots: ["src/root.tsx", "src/routes/index.tsx"], extra: { "src/routes/index.tsx": `export default function Index() { return <p>x</p>; }` } }),
  );
  const variants = [
    `export default function Root(props: { data: number[] }) { props = { data: [] }; return <App data={props.data} />; }`,
    `export default function Root(props: { data: number[] }) { const f = (props: any) => props; return <App data={props.data} />; }`,
    `export default function Root(props: { data: number[] }) { props.data = []; return <App data={props.data} />; }`,
    `export default function Root(props: { data?: number[] }) { return <App data={props?.data} />; }`,
    `export default function Root(props: { data: number[]; children: any }) { return <App data={props.children} />; }`,
    `export default function Root(props: { data: number[] }) { return <App data={props.data}>{props.data}</App>; }`,
    `export default function Root(props: { data: number[] }) { return <App {...props} />; }`,
    `export default function Root(props: { data: number[] }) { return <App data={props.data.slice(1)} />; }`,
    `export default function Root(props: { data: number[] }) { return <App data={props[String(1)]} />; }`,
  ];
  for (const body of variants) dependent(run(`import { App } from "./page.tsx";\n` + body));
});

test("a caller whose props are live (a function passed at its site) forwards nothing", () => {
  const out = run(
    `import { Mid } from "./mid.tsx";
import { signal } from "@rivetjs/reactivity";
export default function Root(props: { data: number[] }) { const s = signal(props.data); return <Mid rows={s()} onPick={() => s.set([])} />; }`,
    {
      extra: {
        "src/mid.tsx": `import { App } from "./page.tsx";\nexport function Mid(props: { rows: number[] }) { return <section><App data={props.rows} /></section>; }`,
      },
    },
  );
  assert.equal(out.verdicts.get("src/page.tsx")!.get("App")!.independent, false);
});

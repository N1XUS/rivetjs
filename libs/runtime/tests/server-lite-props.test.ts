// JS-DIET-2: a lite residual that reads its record's props (manifest `lite.props`) needs them on the record: a `DEMOTED`
// record (props not data) of such a boundary keeps the page on the full runtime; other residuals stay lite.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function App(props: { label: string; f?: () => number }) {
  const n = signal(0);
  return <button onClick={() => n.set(n() + props.label.length)}>{n()}</button>;
}`;
const RESUME = { module: "src/a.tsx", boundaries: ["App"], independent: ["App"] };
const compiled = hasDerivedModel() ? test : test.skip;

compiled("a DEMOTED record of a props-reading residual is not lite; data props or a residual without props reads stay lite", async () => {
  const server = compile(SOURCE, { target: "server", filename: "a.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  const { App } = await importServer<{ App: (props: { label: string; f?: () => number }) => ServerValue }>(server.code);
  const runtime = async (props: { label: string; f?: () => number }, lite: { props?: string[] }) => {
    const html = (await derivedToString(() => App(props), {
      manifest: {
        runtime: "/rt.js",
        symbols: { "src/a.tsx#App": "/a.js" },
        lite: { runtime: "/lite.js", symbols: { "src/a.tsx#App": "/a-lite.js" }, ...lite },
      },
    })) as string;
    return /data-rt="([^"]+)"/.exec(html)?.[1];
  };
  assert.equal(await runtime({ label: "x", f: () => 1 }, { props: ["src/a.tsx#App"] }), "/rt.js");
  assert.equal(await runtime({ label: "x", f: () => 1 }, {}), "/lite.js");
  assert.equal(await runtime({ label: "x" }, { props: ["src/a.tsx#App"] }), "/lite.js");
});

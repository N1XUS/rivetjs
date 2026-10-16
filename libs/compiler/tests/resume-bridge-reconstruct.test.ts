// Function Bridge T27 (C14): reconstruct(() => …) is a computed site with equals: false — the server never encodes the
// value, the browser runs the factory (a captured closure: ordinary capture rules) on first read.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

type Out = { code: string; diagnostics: { code: string; message: string }[]; symbols: { id: string; kind: string; source: string; captures: string[] }[] };
const source = `import { signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
export function Page() { const n = signal(0); const url = "wss://x"; const conn = reconstruct(() => ({ url }));
  return <button onClick={() => n.set(conn().url.length)}>{n()}</button>; }`;
const run = (src: string, options: Record<string, unknown>) => compile(src, { filename: "a.tsx", ...options } as never) as unknown as Out;

test("resume server: a computed site with equals false", () => {
  const { code, diagnostics } = run(source, { target: "server", resume: { module: "src/a.tsx" } });
  assert.deepEqual(diagnostics, []);
  assert.match(code, /const conn = __rivetR_computed\("src\/a\.tsx#Page\$[0-9a-z_]+", \(\) => \(\{ url \}\), \[url\], \{ equals: false \}\)/);
});

test("the browser symbol takes the factory's captures", () => {
  const { symbols } = run(source, { target: "dom", resume: { module: "src/a.tsx" } });
  const symbol = symbols.find((s) => s.kind === "computed")!;
  assert.ok(symbol, JSON.stringify(symbols.map((s) => s.kind)));
  assert.deepEqual(symbol.captures, ["url"]);
  assert.match(symbol.source, /\(url\) => \(\(\) => \(\{ url \}\)\)/);
});

test("plain server imports the twin; DOM keeps the call", () => {
  assert.match(run(source, { target: "server" }).code, /import \{ reconstruct \} from "@rivetjs\/runtime\/server"/);
  assert.match(run(source, { target: "dom", resume: { module: "src/a.tsx" } }).code, /reconstruct\(\(\) => \(\{ url \}\)\)/);
});

test("a factory with no captures (resource holder / library object) records no captures", () => {
  const src = `import { signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/server";
import { createChart } from "chart-lib";
export function Page() { const n = signal(0); const chart = reconstruct(() => createChart(4));
  return <button onClick={() => n.set(chart().size())}>{n()}</button>; }`;
  const { code, diagnostics } = run(src, { target: "server", resume: { module: "src/a.tsx" } });
  assert.deepEqual(diagnostics, []);
  assert.match(code, /const chart = __rivetR_computed\("src\/a\.tsx#Page\$[0-9a-z_]+", \(\) => createChart\(4\), \[\], \{ equals: false \}\)/);
});

test("a non-serializable capture inside the factory is RV2003 at the capture", () => {
  const src = `import { signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
import { Chart } from "chart-lib";
export function Page() { const n = signal(0); const c = new Chart(); const conn = reconstruct(() => c.wrap());
  return <button onClick={() => n.set(conn().size())}>{n()}</button>; }`;
  const { diagnostics } = run(src, { target: "server", resume: { module: "src/a.tsx" } });
  assert.equal(diagnostics[0]?.code, "RV2003", JSON.stringify(diagnostics));
});

test("a local function named reconstruct is not a site", () => {
  const src = `import { signal } from "@rivetjs/reactivity";
const reconstruct = <T,>(f: () => T) => f;
export function Page() { const n = signal(0); const conn = reconstruct(() => 1);
  return <button onClick={() => n.set(conn())}>{n()}</button>; }`;
  assert.doesNotMatch(run(src, { target: "server", resume: { module: "src/a.tsx" } }).code, /__rivetR_computed/);
});

// Wire table repeats (`{y: base}`, resume-format `repeated`): repeated component instances' props recipes are
// written once; each later one is `{y}` and decodes to the base's symbol with its own captures.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { createDecoder, repeated } from "@rivetjs/runtime/resume-format";
import type { TableEntry } from "@rivetjs/runtime/resume-format";
import { compileResume, importServer } from "./resume/compile.ts";

const source = `import { signal } from "@rivetjs/reactivity";
function Badge(props: { label: string; count: number }) {
  return <span title={props.label}>{props.count}</span>;
}
export function Page() {
  const n = signal(1);
  return <div>{[0, 1, 2, 3, 4].map((i) => <Badge count={n() + i} label={"L" + i} />)}<button onClick={() => n.set(n() + 1)}>+</button></div>;
}`;
const dom = compileResume(source, "dom", "src/repeat.tsx");
const server = await importServer<{ Page(): never }>(compileResume(source, "server", "src/repeat.tsx").code);
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c.js"])) };

test("repeated recipes: written once, later instances as {y}; each decodes to its own captures", async () => {
  const html = await resumableToString(() => server.Page(), { manifest });
  const t = (JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { t: TableEntry[] }).t;
  const repeats = t.flatMap((entry, i) => (entry !== null && typeof entry === "object" && "y" in entry ? [i] : []));
  assert.ok(repeats.length >= 3, JSON.stringify(t));
  const calls: [string | number, unknown[]][] = [];
  const decoder = createDecoder(t, {
    signal: () => Object.assign(() => 1, { set() {} }) as never,
    fn: (symbol, captures) => (calls.push([symbol, captures]), () => {}),
  });
  for (const i of repeats) {
    const full = repeated(t, i, (t[i] as { y: number }).y);
    assert.ok(full.f !== undefined && full.a!.every((ref) => ref < t.length));
    decoder.get(i);
  }
  // One symbol; the captured row values differ per instance (0..4 after the first).
  assert.equal(new Set(calls.map(([symbol]) => symbol)).size, 1);
  assert.deepEqual(
    calls.map(([, captures]) => captures.at(-1)),
    [1, 2, 3, 4].slice(-calls.length),
  );
});

test("repeated recipes: a malformed repeat throws when read", () => {
  assert.throws(() => createDecoder([{ y: 0 }]).get(0), /repeat/);
  assert.throws(() => createDecoder([1, { y: 0 }]).get(1), /repeat/);
});

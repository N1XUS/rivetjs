// Streamed segments at scale (SSR-STREAM 2026-11-05): a page with ≥ 100 streamed `Async` / `Suspense` boundaries. The
// segment writer takes the earliest registered settled segment whose parent is out (a min-heap, not a rescan of every
// boundary per write), and a settled segment not written yet ships its pending entry once (patches used to repeat every
// such entry: O(n²) bytes). Pinned here: each segment once, parents before children, settle order kept when segments
// settle one at a time, each pending entry once, every value with its own segment, Suspense contents in claim order.
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import { renderDerived } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";

const compiled = hasDerivedModel() ? test : test.skip;
const N = 120;
const ITEM = `import { signal } from "@rivetjs/reactivity";
import { Async, Suspense } from "@rivetjs/runtime/dom";
export function Item(props: { label: string }) {
  const n = signal(0);
  return <button class="item" onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
`;
const FLAT =
  ITEM +
  `export function App(props: { loads: PromiseLike<string>[]; nest: boolean }) {
  const count = signal(0);
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      {props.loads.map((p) => (
        <Async load={() => p} fallback={() => <p class="wait">wait</p>}>
          {(value) => (
            <div class="row">
              <Item label={value} />
              {props.nest ? <Async load={() => p.then((x) => x + "i")} fallback={() => <i>w</i>}>{(w) => <Item label={w} />}</Async> : null}
            </div>
          )}
        </Async>
      ))}
    </section>
  );
}
`;
const SUSPENSE =
  ITEM +
  `export function App(props: { loads: PromiseLike<string>[] }) {
  const count = signal(0);
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      {props.loads.map((p) => (
        <Suspense fallback={() => <p class="wait">wait</p>}>
          {() => <div class="row"><Async load={() => p}>{(value) => <Item label={value} />}</Async></div>}
        </Suspense>
      ))}
    </section>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["App", "Item"], independent: ["App"] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js", "src/page.tsx#Item": "/page.js" } };
type App = (props: Record<string, unknown>) => never;
async function build(source: string): Promise<App> {
  const server = compile(source, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  return (await importServer<{ App: App }>(server.code)).App;
}
type Order = "registration" | "reverse" | "random" | "tick" | "tick-reverse";
function order(kind: Order): number[] {
  const list = Array.from({ length: N }, (_, i) => i);
  if (kind === "reverse" || kind === "tick-reverse") list.reverse();
  if (kind === "random")
    for (let i = list.length - 1, s = 7; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  return list;
}
/** Stream `App` over N loads settled in `kind` order (all at once, or one per macrotask for `tick*`). */
async function stream(App: App, kind: Order, props: Record<string, unknown> = {}): Promise<string> {
  const resolvers: (() => void)[] = [];
  const loads = Array.from({ length: N }, (_, i) => new Promise<string>((resolve) => resolvers.push(() => resolve("v" + i))));
  const chunks: string[] = [];
  const done = renderDerived(() => App({ loads, ...props }), { write: (chunk: string) => void chunks.push(chunk) }, { manifest, stream: {} } as never);
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const i of order(kind)) {
    resolvers[i]!();
    if (kind.startsWith("tick")) await new Promise((resolve) => setImmediate(resolve));
  }
  await done;
  return chunks.join("");
}
type Entry = [number, number, number, ...unknown[]];
/** Tail + patches in page order: their `a` entries, and the segment ids written (`$rD`) in order. */
function parse(html: string): { tails: Entry[][]; written: number[] } {
  const tails = [...html.matchAll(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/gs)].map(
    (m) => ((expandTail(JSON.parse(m[1]!)) as { a?: Entry[] }).a ?? []) as Entry[],
  );
  const written = [...html.matchAll(/\$rD\((\d+)\)/g)].map((m) => Number(m[1]));
  return { tails, written };
}

for (const kind of ["registration", "reverse", "random", "tick", "tick-reverse"] as const)
  compiled(`server: ${N} streamed Async segments settled in ${kind} order — each once, its value in its own patch, pending once`, async () => {
    const App = await build(FLAT);
    const html = await stream(App, kind, { nest: false });
    const { tails, written } = parse(html);
    assert.deepEqual(
      [...written].sort((a, b) => a - b),
      Array.from({ length: N }, (_, i) => i + 1),
      "every segment written once",
    );
    if (kind === "tick")
      assert.deepEqual(
        written,
        order(kind).map((i) => i + 1),
        "one at a time: in settle order",
      );
    if (kind === "tick-reverse")
      assert.deepEqual(
        written,
        order(kind).map((i) => i + 1),
        "one at a time: in settle order",
      );
    // The shell tail names every segment pending; each patch then carries its own segment's value and no pending repeat.
    assert.deepEqual(
      tails[0],
      Array.from({ length: N }, (_, i) => [i + 1, 1, i]),
    );
    tails.slice(1).forEach((a, i) => assert.deepEqual(a, [[written[i]!, 1, written[i]! - 1, 1, "v" + (written[i]! - 1)]]));
    assert.ok(html.length < N * 500, "linear bytes: " + html.length);
  });

for (const kind of ["registration", "reverse", "random", "tick"] as const)
  compiled(`server: ${N} nested streamed segments (${kind}) — each child after its parent, each pending entry once`, async () => {
    const App = await build(FLAT);
    const html = await stream(App, kind, { nest: true });
    const { tails, written } = parse(html);
    assert.deepEqual(
      [...written].sort((a, b) => a - b),
      Array.from({ length: 2 * N }, (_, i) => i + 1),
    );
    const at = new Map(written.map((id, i) => [id, i]));
    const parentOf = new Map<number, number>();
    const pending = new Map<number, number>();
    tails.forEach((a, t) => {
      for (const e of a)
        if (e.length === 3) {
          assert.ok(!pending.has(e[0]), "pending entry " + e[0] + " repeated");
          pending.set(e[0], t);
          // A child is keyed by its parent segment (`b` = -parent id).
          if (e[1] < 0) parentOf.set(e[0], -e[1]);
        }
      const settled = a.filter((e) => e.length > 3);
      if (t > 0)
        assert.deepEqual(
          settled.map((e) => e[0]),
          [written[t - 1]],
          "patch " + t + ": its own segment's value only",
        );
    });
    assert.equal(parentOf.size, N);
    for (const [child, parent] of parentOf) assert.ok(at.get(parent)! < at.get(child)!, child + " after " + parent);
    assert.equal(pending.size, 2 * N);
  });

compiled(`server: ${N} streamed Suspense contents — each once, in claim order, the tail after the last`, async () => {
  const App = await build(SUSPENSE);
  for (const kind of ["registration", "reverse", "random"] as const) {
    const html = await stream(App, kind);
    const swapped = [...html.matchAll(/\$rS\((\d+)\)/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      swapped,
      Array.from({ length: N }, (_, i) => i + 1),
      kind,
    );
    assert.ok(html.lastIndexOf("$rS(" + N + ")") < html.indexOf('<script type="rivet/boundaries"'), kind + ": the tail follows the contents");
    for (let i = 0; i < N; i++) assert.ok(html.includes(">v" + i + "0</button>"), kind + ": content " + i);
  }
});

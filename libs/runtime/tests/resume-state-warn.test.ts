// STATE-WARN (dev, server render): a captured value that takes ≥ RIVET_STATE_WARN_BYTES (default 8 KiB) of `rivet/state`
// warns once per capture site and process (`dev/on.ts` `stateBytes`, sites from `server-resume.ts` `devStateSites`); a
// page whose state passes RIVET_STATE_BUDGET_BYTES (default 64 KiB) gets one summary with its 3 largest sites. Production
// (default resolution): nothing (`DEV` is false; bytes covered by the zero-cost dev-leak scan).
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { DEV } from "#dev";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; label: string; text: string };

const source = `import { For } from "@rivetjs/runtime/dom";
import { Async } from "@rivetjs/runtime/server";
import { signal } from "@rivetjs/reactivity";
export const sel = signal(0);
export function Whole(p) {
  const rows = p.rows;
  return <button onClick={() => sel.set(rows.length)}>pick</button>;
}
export function Picked(p) {
  const id = p.rows[0].id;
  return <button onClick={() => sel.set(id)}>pick</button>;
}
export function Text(p) {
  const big = p.text;
  return <button onClick={() => sel.set(big.length)}>pick</button>;
}
export function Held(p) {
  const all = signal(p.rows);
  return <p>{all().length}</p>;
}
export function Nested(p) {
  const rows = p.rows;
  const choose = () => sel.set(rows.length);
  return <button onClick={() => choose()}>pick</button>;
}
export function Shared(p) {
  const rows = p.rows;
  return <div><button onClick={() => sel.set(rows.length)}>a</button><button onClick={() => sel.set(rows.length + 1)}>b</button></div>;
}
export function Keyed(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => <li onClick={() => sel.set(row().id)}>{row().label}</li>}</For></ul>;
}
export function Loaded() {
  return <main><h1 onClick={() => sel.set(1)}>x</h1><section><Async load={() => globalThis.__rows(300)} fallback={() => <i>…</i>}>{(v) => <p>{v.length}</p>}</Async></section></main>;
}
export function Streamed() {
  return <main><h1 onClick={() => sel.set(1)}>x</h1><section><Async load={() => globalThis.__rows(301)} fallback={() => <i>…</i>}>{(v) => <Text text={JSON.stringify(v)} />}</Async></section></main>;
}
export function Many(p) {
  return <div><Whole rows={p.a} /><Text text={p.b} /><Held rows={p.c} /><Picked rows={p.a} /></div>;
}
`;
const dom = compileResume(source, "dom", "src/state.tsx");
const server = compileResume(source, "server", "src/state.tsx");
const mod = await importServer<Record<string, (p: object) => ServerValue>>(server.code);
const manifest: ResumeManifest = {
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
  captures: Object.fromEntries(server.symbols.map((s) => [s.id, s.labels ?? s.captures])),
};
(globalThis as { __rows?: (n: number) => Promise<Row[]> }).__rows = (n) => new Promise((resolve) => setTimeout(() => resolve(rows(n)), 5));
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i, label: "row " + i, text: "x".repeat(20) }));
const render = (factory: () => ServerValue, options: Partial<ResumeManifest> = {}): Promise<string> =>
  Promise.resolve(resumableToString(factory, { manifest: { ...manifest, ...options } }) as string);
const stateBytes = (html: string): number => /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!.length;

let warn: { mock: { calls: unknown[][] }; mockClear(): void; mockRestore(): void };
const warnings = (): string[] => warn.mock.calls.map((call) => String(call[0])).filter((text) => text.startsWith("Rivet resume: "));
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  delete process.env.RIVET_STATE_WARN_BYTES;
  delete process.env.RIVET_STATE_BUDGET_BYTES;
});

const dev = test.skipIf(!DEV);

dev("a handler capturing a large array warns: component, site, capture name, shape, bytes, page total, fix, docs", async () => {
  const html = await render(() => mod.Whole!({ rows: rows(400) }));
  // Once per site and process: a second render of the same page does not warn again.
  await render(() => mod.Whole!({ rows: rows(400) }));
  const [message, ...rest] = warnings();
  assert.equal(rest.length, 0);
  assert.match(message!, /^Rivet resume: <Whole> onClick handler captures `rows` \(src\/state\.tsx#Whole\$/);
  assert.match(message!, /: array of 400 objects, \d+\.\d KB of rivet\/state \(warning threshold 8\.0 KB; this page's state so far (\d+\.\d) KB\)/);
  const total = Number(/so far (\d+\.\d) KB/.exec(message!)![1]);
  assert.equal(total, Number((stateBytes(html) / 1024).toFixed(1)));
  assert.match(message!, /fix: 1\. do not capture it/);
  assert.match(message!, /2\. load it in the browser instead: serve it from an endpoint \(an onGet\(…\) export\)/);
  assert.match(message!, /3\. a list: keyed <For each=\{…\} by=\{…\}> rows; today each row still ships its item .*lazyRows: true.*RIVET_LAZY_ROWS=on/);
  assert.match(message!, /4\. a library object .*reconstruct\(\(\) => …\)/);
  assert.match(message!, /docs: https:\/\/rivetjs\.severyn\.pro\/learn\/resuming#large-data-in-resume-state$/);
});

dev("small captures do not warn (an id instead of the list)", async () => {
  await render(() => mod.Picked!({ rows: rows(400) }));
  assert.deepEqual(warnings(), []);
});

dev("RIVET_STATE_WARN_BYTES: a byte threshold; off / 0 turns the per-value warning off", async () => {
  process.env.RIVET_STATE_WARN_BYTES = "off";
  await render(() => mod.Text!({ text: "y".repeat(20000) }));
  assert.deepEqual(warnings(), []);
  process.env.RIVET_STATE_WARN_BYTES = "30000";
  await render(() => mod.Text!({ text: "y".repeat(20000) }));
  assert.deepEqual(warnings(), []);
  process.env.RIVET_STATE_WARN_BYTES = "1000";
  await render(() => mod.Text!({ text: "y".repeat(20000) }));
  const [message, ...rest] = warnings();
  assert.equal(rest.length, 0);
  assert.match(
    message!,
    /^Rivet resume: <Text> onClick handler captures `big` \(src\/state\.tsx#Text\$\w+\): string of 19\.5 KB, 19\.5 KB of rivet\/state \(warning threshold 1000 B;/,
  );
});

dev("a signal a binding captures: named by the binding and the capture, shape through the signal", async () => {
  await render(() => mod.Held!({ rows: rows(300) }));
  const [message, ...rest] = warnings();
  assert.equal(rest.length, 0);
  assert.match(message!, /^Rivet resume: <Held> text binding captures `all` \(src\/state\.tsx#Held\$\w+\): signal holding array of 300 objects, \d+\.\d KB/);
});

dev("a local function's capture: the function's own site, named by its symbol and capture", async () => {
  await render(() => mod.Nested!({ rows: rows(300) }));
  const [message, ...rest] = warnings();
  assert.equal(rest.length, 0);
  assert.match(message!, /^Rivet resume: <Nested> function captures `rows` \(src\/state\.tsx#Nested\$\w+\): array of 300 objects/);
});

dev("a value two handlers share is counted once, at the first", async () => {
  await render(() => mod.Shared!({ rows: rows(300) }));
  const messages = warnings();
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /^Rivet resume: <Shared> onClick handler captures `rows`/);
});

dev("page budget: one summary per render with the 3 largest sites (and once per process for the same sites)", async () => {
  process.env.RIVET_STATE_WARN_BYTES = "off";
  const page = () => mod.Many!({ a: rows(400), b: "z".repeat(30000), c: rows(600) });
  await render(page);
  await render(page);
  const summaries = warnings().filter((text) => text.includes("budget"));
  assert.equal(summaries.length, 1);
  const lines = summaries[0]!.split("\n");
  assert.match(lines[0]!, /^Rivet resume: this page's rivet\/state is \d+\.\d KB \(budget 64\.0 KB\), \d+\.\d KB of it captured values; largest captures:$/);
  assert.match(lines[1]!, /^ {2}1\. \d+\.\d KB {2}<Held> text binding .*: signal holding array of 600 objects$/);
  assert.match(lines[2]!, /^ {2}2\. \d+\.\d KB {2}<Text> onClick handler captures `big` .*: string of 29\.3 KB$/);
  assert.match(lines[3]!, /^ {2}3\. \d+\.\d KB {2}<Whole> onClick handler captures `rows` .*: array of 400 objects$/);
  assert.match(lines[4]!, /^ {2}fix: 1\. do not capture it/);
  assert.match(summaries[0]!, /docs: https:\/\/rivetjs\.severyn\.pro\/learn\/resuming#large-data-in-resume-state$/);
  // RIVET_STATE_BUDGET_BYTES=off: none.
  process.env.RIVET_STATE_BUDGET_BYTES = "off";
  warn.mockClear();
  await render(() => mod.Many!({ a: rows(401), b: "q".repeat(30000), c: rows(601) }));
  assert.deepEqual(warnings(), []);
});

dev(
  "keyed For rows: each row item is its own value (no per-value warning), summed in the summary; lazy rows (RIVET_LAZY_ROWS=on) capture nothing",
  async () => {
    process.env.RIVET_STATE_BUDGET_BYTES = "4000";
    try {
      process.env.RIVET_LAZY_ROWS = "on";
      const lazy = await render(() => mod.Keyed!({ rows: rows(300) }), { lazyRows: true });
      assert.match(lazy, /"L":/);
      assert.ok(stateBytes(lazy) > 4000);
      assert.deepEqual(warnings(), []);
      process.env.RIVET_LAZY_ROWS = "off";
      await render(() => mod.Keyed!({ rows: rows(300) }));
      const messages = warnings();
      assert.equal(messages.length, 1);
      assert.match(
        messages[0]!,
        /largest captures:\n {2}1\. \d+\.\d KB {2}<Keyed> For row items \(src\/state\.tsx#Keyed\$\w+\): object with 3 keys \(×300\)\n/,
      );
    } finally {
      delete process.env.RIVET_LAZY_ROWS;
    }
  },
);

dev("an Async payload no resumed code captures never warns; a capture in a streamed segment does, with the page total so far", async () => {
  process.env.RIVET_STATE_WARN_BYTES = "2000";
  const streamed = async (factory: () => ServerValue): Promise<string> => {
    const chunks: string[] = [];
    await renderResumable(factory, { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
    return chunks.join("");
  };
  await render(() => mod.Loaded!({}));
  const loaded = await streamed(() => mod.Loaded!({}));
  assert.match(loaded, /data-patch=/);
  assert.deepEqual(warnings(), []);
  // `<Text>`'s capture warned in an earlier test (console: once per site and process); the devtools event reports
  // every render: the segment's site, with the page total so far (shell + this patch).
  const events: { site: string; bytes: number; total: number }[] = [];
  (globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.devtools")] = {
    emit: (type: string, data: never) => void (type === "resume.state" && events.push(data)),
  };
  try {
    const html = await streamed(() => mod.Streamed!({}));
    const patch = /<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/s.exec(html)![1]!;
    const shell = /<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!;
    assert.equal(events.length, 1);
    assert.match(events[0]!.site, /^<Text> onClick handler captures `big`/);
    assert.equal(events[0]!.total, shell.length + patch.length);
    assert.ok(patch.length > 2000 && shell.length < 2000);
  } finally {
    delete (globalThis as { [key: symbol]: unknown })[Symbol.for("rivet.devtools")];
  }
});

test("production (default resolution): no state warnings", async () => {
  process.env.RIVET_STATE_WARN_BYTES = "1";
  process.env.RIVET_STATE_BUDGET_BYTES = "1";
  await render(() => mod.Many!({ a: rows(400), b: "p".repeat(30000), c: rows(600) }));
  assert.equal(DEV, false);
  assert.deepEqual(warnings(), []);
});

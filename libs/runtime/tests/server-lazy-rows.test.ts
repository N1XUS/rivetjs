// Lazy collection rows T1, the `swap` measurement harness (`server-lazy-rows.ts`, never shipped): For rows in a
// resumable region render unrecorded (no `data-r`, handlers, bindings or row records), marked `<!--L-->` / `<!--l-->`,
// and their region gets the `interaction` mount trigger (create + swap on the first input). Same markup otherwise.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
function Btn({ label }) {
  const n = signal(0);
  return <button onClick={() => n.set(n() + 1)}>{label}{n()}</button>;
}
// Uniform rows (a row plan) and component rows.
export function Rows({ items }) {
  const picked = signal("b");
  const list = signal(items);
  return <section>
    <ul><For each={list} by={(x) => x}>{(x) =>
      <li class={picked() === x() ? "on" : "off"}><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>
    <ol><For each={list} by={(x) => x}>{(x) => <li><Btn label={x()} /></li>}</For></ol>
    <p onClick={() => picked.set("")}>{picked()}</p>
  </section>;
}
`;
const symbols = compileResume(source, "dom").symbols;
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const fixture = await importServer<{ Rows: (props: { items: string[] }) => unknown }>(compileResume(source, "server").code);
const render = () => resumableToString(() => fixture.Rows({ items: ["a", "b", "c"] }) as never, { manifest }) as Promise<string>;
const stateOf = (html: string) =>
  JSON.parse(/<script type="rivet\/state"[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!) as { b: unknown[][]; e: Record<string, unknown> };
const markup = (html: string) =>
  html
    .slice(0, html.indexOf("<script"))
    .replace(/ data-r="\d+"/g, "")
    .replace(/<!--[^>]*-->/g, "");

test("swap harness: rows render unrecorded with lazy markers; the region re-creates at the first interaction", async () => {
  const before = await render();
  const recorded = stateOf(before);
  assert.ok(
    recorded.b.some((entry) => entry[1] === "#" && entry[8]),
    "today: row lists in region entries",
  );
  const { _lazyRowsSwap } = await import("../server-lazy-rows.ts");
  _lazyRowsSwap();
  _lazyRowsSwap();
  const after = await render();
  assert.equal(markup(after), markup(before));
  assert.equal((after.match(/<!--L-->/g) ?? []).length, 2);
  assert.equal((after.match(/<!--l-->/g) ?? []).length, 6);
  const lazy = stateOf(after);
  // No row lists, no row records: only the regions (now mounting at `interaction`) and the paragraph's handler.
  assert.ok(lazy.b.every((entry) => !(entry[1] === "#" && entry[8])));
  const regions = lazy.b.filter((entry) => entry[1] === "#");
  assert.ok(regions.length >= 2 && regions.every((entry) => entry[7] === "interaction"));
  assert.equal(Object.keys(lazy.e).length, 1);
  assert.ok(after.length < before.length);
});

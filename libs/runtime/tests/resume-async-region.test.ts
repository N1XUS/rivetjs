// Awaited (non-streamed) Async content renders in the traversal, after the read that constructed the boundary: its
// records still belong to that read's region (a Router's route content: the browser disposes the page's resumed state,
// and what client code created inside it, an open overlay, when it re-creates the Router region). Output unchanged:
// rows render without row markers, as at the page root.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface State {
  b: [number, string | null, string, number[], number[], number[], number, ...unknown[]][];
}

const source = `
import { signal } from "@rivetjs/reactivity";
import { Async, For } from "@rivetjs/runtime/server";
function Inner() {
  const n = signal(0);
  return <button id="inner" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
const items = ["x", "y", "z"];
export function Page() {
  const tab = signal("a");
  return <main>{tab() === "a" ? <Async load={() => Promise.resolve(items)}>{(xs: string[]) => <section><Inner /><For each={xs} by={(x: string) => x}>{(x) => <i>{x()}</i>}</For></section>}</Async> : null}</main>;
}
export function Plain() {
  return <main><Async load={() => Promise.resolve(items)}>{() => <Inner />}</Async></main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Page(): ServerValue; Plain(): ServerValue }>(compileResume(source, "server").code);
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const stateOf = (html: string): State => JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);

test("resume: awaited Async content belongs to the region that constructed the boundary", async () => {
  const html = await resumableToString(() => server.Page(), { manifest });
  const state = stateOf(html);
  const regions = state.b.filter((entry) => entry[1] === "#");
  assert.equal(regions.length, 1);
  const site = regions[0]![0];
  // Inner's text binding (rendered after the await) is a child of the site's region, not of the page root.
  const text = state.b.find((entry) => entry[1] === null)!;
  assert.ok(text, "Inner's text binding is recorded");
  assert.equal(text[6], site);
  // Rows render as at the page root (no row regions): only the site's own region marker.
  assert.equal([...html.matchAll(/<!--r\d*\[-->/g)].length, 1);
  assert.match(html, /<i>x<\/i><i>y<\/i><i>z<\/i>/);
});

test("resume: awaited Async content outside any region stays at the page root", async () => {
  const state = stateOf(await resumableToString(() => server.Plain(), { manifest }));
  assert.equal(state.b.find((entry) => entry[1] === null)![6], -1);
});

// STATIC-ZERO T3 (value liveness): a conditional boundary (`COND`) whose only change source is a handler the compiler
// cannot tell is a function (`cond ? f : undefined`, `props.onX`) keeps its record only for an instance that installs one
// (`_rHandler` with a function, or `_rHandlers` over its own spread seeing a listener function); a page whose handlers are all
// absent ships no tail, no loader, no runtime. Compiled end to end with the build's verdicts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";

const SOURCE = `
import { sync } from "./sync.ts";
export function Log(props) {
  return <div role="log" onScroll={props.track ? (e) => sync(e.currentTarget) : undefined}>{props.children}</div>;
}
export function Box(props) {
  return <div class="box" {...props} />;
}
export function Page(props) {
  return (
    <main>
      <Log track={props.track}>
        <p>hi</p>
      </Log>
      <Box onPointerEnter={props.enter ? () => 1 : undefined} />
    </main>
  );
}
`;
const it = hasDerivedModel() ? test : test.skip;
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "m#Log": "/m.js", "m#Box": "/m.js", "m#Page": "/m.js" } };
type Mod = { Page: (props: { track?: boolean; enter?: boolean }) => ServerValue };

async function page(): Promise<Mod> {
  const out = compile(SOURCE.replace('"./sync.ts"', '"data:text/javascript,export const sync = () => {}"'), {
    target: "server",
    filename: "m.tsx",
    resume: { module: "m", boundaries: ["Log", "Box", "Page"], independent: [], conditional: ["Log", "Box", "Page"] },
  });
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /__rivetR_handler\(__rivetB, props\.track \? .* : undefined, "scroll"\)/);
  return importServer<Mod>(out.code);
}
const render = async (props: { track?: boolean; enter?: boolean }) => {
  const { Page } = await page();
  return (await derivedToString(() => Page(props), { manifest })) as string;
};
const tailOf = (html: string) => JSON.parse(/<script type="rivet\/boundaries"([^>]*)>(.*?)<\/script>/s.exec(html)![2]!);
const attrsOf = (html: string) => /<script type="rivet\/boundaries"([^>]*)>/.exec(html)![1]!;

it("absent handlers: no record, no tail, no loader", async () => {
  const html = await render({});
  assert.ok(!html.includes("rivet/boundaries"), html);
  assert.ok(!html.includes("<script"), html);
  assert.ok(html.includes('data-b="'), "inert markers stay");
});

it("a conditional handler that is a function keeps its boundary (and the chain up), its type delegated", async () => {
  const html = await render({ track: true });
  const tail = tailOf(html);
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r[3]),
    ["m#Page", "m#Log"],
  );
  assert.match(attrsOf(html), /data-events="[^"]* scroll"/);
});

it("a spread listener prop that is a function keeps its boundary", async () => {
  const html = await render({ enter: true });
  const tail = tailOf(html);
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r[3]),
    ["m#Page", "m#Box"],
  );
  assert.match(attrsOf(html), /data-events="[^"]* pointerenter"/);
  assert.doesNotMatch(attrsOf(html), /scroll/);
});

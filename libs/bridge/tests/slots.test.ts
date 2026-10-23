// T3 slots: hole markup + split, Rivet slot content written in place inside the holes (resumable: the slot content is
// part of the enclosing boundary), a missing / duplicated hole fails the island in every build (fallback, else RV2144 naming the island and the slot).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { slotMark, splitSlots } from "../slots.ts";
import { calls } from "./fake-adapter.ts";
import { page, tailOf } from "./harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Page = () => ServerValue;

test("slotMark: default hole has no name; names are attribute-escaped", () => {
  assert.equal(slotMark("default").html, '<rivet-slot style="display:contents"></rivet-slot>');
  assert.equal(slotMark("title").html, '<rivet-slot name="title" style="display:contents"></rivet-slot>');
  assert.equal(slotMark('a"<&').html, '<rivet-slot name="a&quot;&lt;&amp;" style="display:contents"></rivet-slot>');
});

test("splitSlots: parts keep the hole tags around the cut; order is document order; duplicates listed, missing absent", () => {
  const d = slotMark("default"),
    t = slotMark("title"),
    x = slotMark("x");
  const html = "<a>" + t.html + "<b>" + d.html + "</b>" + t.html + "</a>";
  const { parts, order } = splitSlots(html, [d, t, x]);
  assert.deepEqual(order, ["title", "default", "title"]);
  assert.equal(parts.length, 4);
  assert.equal(parts.join(""), html);
  assert.ok(parts[0]!.endsWith('<rivet-slot name="title" style="display:contents">'));
  assert.ok(parts[1]!.startsWith("</rivet-slot><b>"));
  assert.deepEqual(splitSlots("<p>none</p>", [d]), { parts: ["<p>none</p>"], order: [] });
});

const source = `
import { signal } from "@rivetjs/reactivity";
import { _island } from "@rivetjs/bridge/server";
import { fake, Card as CardImpl, NoHole as NoHoleImpl, TwoHoles as TwoHolesImpl } from "./fake-adapter.ts";
const CARD = { id: "src/Card.fake#default", c: CardImpl, a: fake };
const NO_HOLE = { id: "src/NoHole.fake#default", c: NoHoleImpl, a: fake };
const TWO = { id: "src/Two.fake#default", c: TwoHolesImpl, a: fake };
function loadCard() { return import("/islands/card.js"); }
export function Card(props) { return <>{_island(props, CARD, loadCard)}</>; }
export function NoHole(props) { return <>{_island(props, NO_HOLE)}</>; }
export function Two(props) { return <>{_island(props, TWO)}</>; }
export function Page() {
  const n = signal(0);
  return <main>
    <button onClick={() => n.set(1)}>before</button>
    <Card label="L" title={<b>Title {n()}</b>}><button onClick={() => n.set(n() + 1)}>{n()}</button></Card>
    <button onClick={() => n.set(2)}>after</button>
  </main>;
}
export function Missing() { return <main><NoHole><i>lost</i></NoHole></main>; }
export function MissingFallback() { return <main><NoHole fallback={<b>fallback</b>}><i>lost</i></NoHole></main>; }
export function Duplicated() { return <main><Two><i>once</i></Two></main>; }
`;
const prod = await page<Record<string, Page>>(source);
const dev = await page<Record<string, Page>>(source, { dev: true });

test("slot content renders in place inside the holes, resumable (the page's boundary holds the buttons and their text)", async () => {
  calls.length = 0;
  const html = (await resumableToString(() => prod.mod.Page!(), { manifest: prod.manifest })) as string;
  assert.deepEqual(calls[0]!.slots.sort(), ["default", "title"]);
  // Framework props exclude slots.
  assert.deepEqual(calls[0]!.props, { label: "L" });
  assert.match(
    html,
    /<button>before<\/button><!--\[--><rivet-island data-ri="i\d+" style="display:contents"><article id="i\d+-card"><h2><rivet-slot name="title" style="display:contents"><b>Title (<!--\[-->)?0(<!--\]-->)?<\/b><\/rivet-slot><\/h2><rivet-slot style="display:contents"><button>0<\/button><\/rivet-slot><i>L<\/i><\/article><\/rivet-island><!--\]--><button>after<\/button>/,
  );
  // One boundary (the page): the island is no boundary of its own; its slot content adopts with the page.
  assert.deepEqual(
    tailOf(html)!.b.map((record) => record[3]),
    ["src/page.tsx#Page"],
  );
});

for (const [build, x] of [
  ["production", prod],
  ["dev", dev],
] as const)
  test(`${build}: a slot without a hole, or with two, fails the island (RV2144 naming the island and the slot); a fallback stands in`, async () => {
    await assert.rejects(
      async () => resumableToString(() => x.mod.Missing!(), { manifest: x.manifest }),
      /\[rivet:bridge\] RV2144 fake island src\/NoHole\.fake#default failed to render: slot "default" has no hole in the rendered HTML/,
    );
    await assert.rejects(
      async () => resumableToString(() => x.mod.Duplicated!(), { manifest: x.manifest }),
      /\[rivet:bridge\] RV2144 fake island src\/Two\.fake#default failed to render: slot "default" has more than one hole/,
    );
    assert.match(
      (await resumableToString(() => x.mod.MissingFallback!(), { manifest: x.manifest })) as string,
      /^<main>(<!--\[-->)?<rivet-island data-ri="i\d+"[^>]*><b>fallback<\/b><\/rivet-island>(<!--\]-->)?<\/main>/,
    );
  });

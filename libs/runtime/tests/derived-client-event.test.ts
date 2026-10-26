// TOAST-ACTIVE (2026-10-26): a boundary whose browser code is a document `clientEvent` (cdk `ToastRegion` listens for
// `rv-toast-queue`) keeps its client trigger on the derived server: the compiler lowers the call to
// `clientEvent(void 0, void 0, void 0, options)` and the server helper flags the open boundary (no `when` = idle →
// `data-boot`; `when: "interaction"` → the unit listens to any type; `standalone: false` → no trigger). Lowered to
// `undefined`, the region never adopted on a resumed page and a `toast()` from a sibling boundary showed nothing.
// Compiled end to end with the build's verdicts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tailJson = (tail: unknown): any => expandTail(tail as never);

const SOURCE = (options: string) => `
import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/dom";
export function Region() {
  const count = signal(0);
  clientEvent(document, "rv-ping", () => count.set(count() + 1)${options});
  return <output>{count()}</output>;
}
export function Trigger() {
  return <button onClick={() => document.dispatchEvent(new CustomEvent("rv-ping"))}>ping</button>;
}
export function Page() {
  return (
    <main>
      <Region />
      <Trigger />
    </main>
  );
}
`;
const it = hasDerivedModel() ? test : test.skip;
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "m#Region": "/m.js", "m#Trigger": "/m.js", "m#Page": "/m.js" } };

async function render(options: string): Promise<{ code: string; html: string }> {
  const out = compile(SOURCE(options), {
    target: "server",
    filename: "m.tsx",
    resume: { module: "m", boundaries: ["Region", "Trigger", "Page"], independent: ["Region", "Trigger", "Page"] },
  });
  assert.deepEqual(out.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(out.code);
  return { code: out.code, html: (await derivedToString(() => Page(), { manifest })) as string };
}
const tagOf = (html: string) => /<script type="rivet\/boundaries"([^>]*)>/.exec(html)?.[1] ?? "";
const tailOf = (html: string) => tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));

it("a document clientEvent without `when` boots its boundary at idle (data-boot); target / handler stay out of the server", async () => {
  const { code, html } = await render(', { preload: "interaction" }');
  assert.doesNotMatch(code, /rv-ping"|document,/);
  assert.match(tagOf(html), / data-boot/);
  const tail = tailOf(html);
  assert.ok(tail.b.some((r: unknown[]) => r[3] === "m#Region"));
  assert.equal(tail.e["m#Region"], undefined, "idle: adopts at boot, listens to no type");
});

it('`when: "interaction"`: no boot, the region\'s unit listens to any event type', async () => {
  const { html } = await render(', { when: "interaction" }');
  assert.doesNotMatch(tagOf(html), / data-boot/);
  assert.equal(tailOf(html).e["m#Region"], "*");
});

it("`standalone: false`: no trigger, no boot", async () => {
  const { html } = await render(", { standalone: false }");
  assert.doesNotMatch(tagOf(html), / data-boot/);
});

// Two instances of the server runtime modules (a dev cache-buster such as Vite's `?t=` re-evaluates
// them under a new URL): values one instance creates render through the other.
import { test } from "vitest";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import * as first from "@rivetjs/runtime/server";

const COPY = "rivet-copy=2";
const runtimeDir = new URL("../", import.meta.url).href;
// Every runtime module imported from the copy is a copy too (reactivity stays shared, as in dev).
registerHooks({
  resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (context.parentURL?.includes(COPY) && result.url.startsWith(runtimeDir) && !result.url.includes("/tests/") && !result.url.includes("?"))
      return { ...result, url: result.url + "?" + COPY };
    return result;
  },
});
const second = (await import(import.meta.resolve("@rivetjs/runtime/server") + "?" + COPY)) as typeof first;

test("a duplicate server runtime instance is a distinct module", () => {
  assert.notEqual(second.renderToString, first.renderToString);
  assert.notEqual(second.compiledTemplate, first.compiledTemplate);
});

test("templates, attributes and scoped regions cross runtime instances", async () => {
  for (const [make, render] of [
    [second, first],
    [first, second],
  ] as const) {
    const fragments = Object.freeze(["<p", ">", "</p>"]);
    const value = make.compiledTemplate(fragments, [
      make.attribute("class", "a&b"),
      [
        make.template(["<i>", "</i>"], ["x"]),
        make.omitted("ignored"),
        make.Provider({ token: { id: "t", defaultValue: 0 } as never, value: 1, children: () => "p" }),
        make.Async({ load: async () => "async", children: (v: string) => make.compiledTemplate(Object.freeze(["<b>", "</b>"]), [v]) }),
        make.ErrorBoundary({ fallback: () => "fallback", children: () => make.compiledTemplate(Object.freeze(["<u>ok</u>"]), []) }),
        make.For({ each: () => [1, 2], by: (n: number) => n, children: (n: () => number) => make.compiledTemplate(Object.freeze(["<s>", "</s>"]), [n()]) }),
      ],
    ]);
    assert.equal(await render.renderToString(value), '<p class="a&amp;b"><i>x</i>p<b>async</b><u>ok</u><s>1</s><s>2</s></p>');
  }
});

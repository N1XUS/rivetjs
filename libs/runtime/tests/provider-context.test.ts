import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// DOM `Provider` returns its content as is (no boundary markers); accessors in it read under the provider
// (`_scoped`), so content created on a later read — a component returning `() => …`, a dynamic fragment
// child — still sees the value.
const unit = `
import { render, Provider, _tpl, _c, _fx, _t } from "/dom.ts";
import { signal, onCleanup, createContext, useContext } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const comments = (root) => { const w = document.createTreeWalker(root, 128); let n = 0; while (w.nextNode()) n++; return n; };
const C = createContext("default");
const leaf = _tpl("<b></b>");
const Leaf = () => { const b = leaf(); _t(b, useContext(C)); return b; };
export function v2Accessors() {
  const target = host(), on = signal(false); let cleaned = 0;
  // A component returning an accessor (built on its first read, after Provider returned) plus a plain node
  // and a nested array holding an accessor.
  const Lazy = () => () => (on() ? _c(Leaf, {}) : "off");
  const stop = render(() => _c(Provider, { token: C, value: "provided", children: () => { onCleanup(() => cleaned++); return [_c(Lazy, {}), _c(Leaf, {}), [() => _c(Leaf, {})]]; } }), target);
  check(target.textContent === "offprovidedprovided", "initial: " + target.innerHTML);
  on.set(true);
  check(target.textContent === "providedprovidedprovided", "lazy content sees the provider: " + target.innerHTML);
  on.set(false); on.set(true);
  check(target.textContent === "providedprovidedprovided", "re-created content too: " + target.innerHTML);
  stop();
  check(cleaned === 1 && target.textContent === "", "provider scope disposed with the root");
  return "passed";
}
export function nestedProviders() {
  const target = host(), D = createContext(0);
  // 30 nested providers of one token: the innermost wins, other tokens resolve through the stack.
  const nest = (i) => i === 30 ? (() => { const b = leaf(); _t(b, useContext(C) + ":" + useContext(D)); return b; })() : _c(Provider, { token: D, value: i + 1, children: () => nest(i + 1) });
  const stop = render(() => _c(Provider, { token: C, value: "c", children: () => nest(0) }), target);
  check(target.textContent === "c:30", "nearest wins: " + target.textContent);
  check(comments(target) === 0, "plain content: no boundary markers: " + target.innerHTML);
  stop();
  return "passed";
}
`;

for (const scenario of ["v2Accessors", "nestedProviders"]) {
  test("dom Provider: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}

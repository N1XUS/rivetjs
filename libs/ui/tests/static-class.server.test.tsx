// Server-target suite: VCLS contract (`libs/compiler/static-class.ts`). For every `@rivet-class` family: with `$cls` = the
// resolver of the declared constant props, the component renders the same markup as without it, for every combination
// of the declared keys; it takes `$cls` as given (a wrong value shows, so the parity above is not the fallback); under a
// value of each `with(…)` context it ignores `$cls` and calls the resolver.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Provider } from "@rivetjs/runtime/dom";
import { _resetIds } from "@rivetjs/runtime/id";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { combinations, loadFamilies } from "./static-class-families.ts";

const families = await loadFamilies();

const html = async (fn: () => unknown): Promise<string> => {
  _resetIds();
  return (await renderToString(fn as never)).replace(/<!--[^>]*-->/g, "");
};

test("static class: ui declares families (Button)", () => {
  assert.ok(families.some((f) => f.family.component === "ButtonRoot"));
});

test("static class (server): `$cls` = the resolver's class renders the same markup, every constant combination", async () => {
  for (const f of families) {
    const C = f.component;
    for (const props of combinations(f)) {
      const cls = f.resolver(props);
      assert.equal(
        await html(() => (
          <C {...props} $cls={cls}>
            x
          </C>
        )),
        await html(() => <C {...props}>x</C>),
        `${f.family.component} ${JSON.stringify(props)}`,
      );
    }
    assert.match(await html(() => <C $cls="vcls-probe">x</C>), /class="vcls-probe"/, f.family.component + " uses $cls");
    for (const ctx of f.contexts) {
      const value = Object.fromEntries(f.family.keys.map((k) => [k, Object.keys(f.resolver.variants?.[k] ?? {}).at(-1)]));
      const inside = await html(() => (
        <Provider token={ctx as never} value={value}>
          <C $cls="vcls-probe">x</C>
        </Provider>
      ));
      assert.doesNotMatch(inside, /vcls-probe/, f.family.component + ": a context value makes it call the resolver");
    }
  }
});

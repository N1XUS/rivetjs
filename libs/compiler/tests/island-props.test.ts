// Server output of island facade calls: props that can read a signal become getters (lane BRIDGE-FIX E1,
// `island-props.ts`); content, island options, constants and other component calls stay values.
import { test } from "vitest";
import assert from "node:assert/strict";
import { islandGetters } from "../island-props.ts";

const islands = async (spec: string) => spec.endsWith(".react.tsx");

test("live entries of an island call become getters; constants, callbacks, options and Rivet content stay values", async () => {
  const code = `import { Live } from "./Live.react.tsx";
import { Plain } from "./plain.tsx";
const k = 3;
export const a = () => Live({ "client": "load", "value": v(), "n": props.n, "k": k, "lit": "s", "t": \`a\${v()}\`, "cb": () => 1, "title": __rivetTemplate(f, [v()]), children: __rivetSlot(() => x()) });
export const b = () => Plain({ "value": v() });`;
  const out = (await islandGetters(code, islands))!;
  assert.ok(out.includes(`get "value"() { return v(); }`), out);
  assert.ok(out.includes(`get "n"() { return props.n; }`), out);
  assert.ok(out.includes(`get "t"() { return \`a\${v()}\`; }`), out);
  for (const kept of [
    `"client": "load"`,
    `"k": k`,
    `"lit": "s"`,
    `"cb": () => 1`,
    `"title": __rivetTemplate(f, [v()])`,
    `children: __rivetSlot`,
    `Plain({ "value": v() })`,
  ])
    assert.ok(out.includes(kept), kept + "\n" + out);
});

test("namespace imports, proven call sites and nested island calls", async () => {
  const code = `import * as UI from "./ui.react.tsx";
import { Card, Live } from "./x.react.tsx";
export const a = () => UI.Chart({ "data": series(range()) });
export const b = () => Card(__rivetR_s({ "body": Live({ "value": v() }) }));`;
  const out = (await islandGetters(code, islands))!;
  assert.ok(out.includes(`UI.Chart({ get "data"() { return series(range()); } })`), out);
  assert.ok(out.includes(`get "body"() { return Live({ get "value"() { return v(); } }); }`), out);
});

test("no island import or nothing live: unchanged (null); `this` / `arguments` stay values", async () => {
  assert.equal(await islandGetters(`import { A } from "./a.tsx";\nA({ "x": f() });`, islands), null);
  assert.equal(await islandGetters(`import { A } from "./a.react.tsx";\nA({ "x": 1, "y": y });`, islands), null);
  assert.equal(await islandGetters(`import { A } from "./a.react.tsx";\nfunction f() { return A({ "x": this.x, "y": arguments[0] }); }`, islands), null);
});

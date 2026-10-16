import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// Plain server builds (no resume) lower `clientEvent(…)` to `undefined`: the server never attaches it, and evaluating its
// `window` / `document` target would throw where those globals do not exist.
test("plain server build drops clientEvent calls with browser-global targets", async () => {
  const source = `import { clientEvent } from "@rivetjs/runtime/dom";
export function A() {
  clientEvent(window, "keydown", (e) => console.log(e));
  clientEvent(document, "visibilitychange", () => {});
  return <div>hi</div>;
}`;
  const { code } = await compile(source, { filename: "a.tsx", target: "server" });
  assert.doesNotMatch(code, /window|document/);
  const module = await import(`data:text/javascript,${encodeURIComponent(code.replace(/^import .*$/gm, "const __rivetTemplate = (f) => f.join('');"))}`);
  assert.equal(module.A(), "<div>hi</div>");
});

test("a local clientEvent is left alone", async () => {
  const source = `const clientEvent = (t: unknown) => t;
export function A() { clientEvent(1); return <div />; }`;
  const { code } = await compile(source, { filename: "a.tsx", target: "server" });
  assert.match(code, /clientEvent\(1\)/);
});

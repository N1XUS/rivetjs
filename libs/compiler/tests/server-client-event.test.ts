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

// Derived server modules keep `clientEffect` as `clientEffect(void 0, options)`: the closure (and the browser-only imports
// it reaches) leaves the SSR bundle, the call still flags the open boundary's client trigger (`when`).
test("derived server build keeps clientEffect's options, drops its closure", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
export default function Home() {
  const ticks = signal(0);
  clientEffect(() => { const t = setInterval(() => ticks.set(ticks() + 1), 1000); return () => clearInterval(t); }, { when: "load" });
  return <button onClick={() => ticks.set(0)}>{ticks()}</button>;
}`;
  const resume = { module: "src/home.tsx", boundaries: ["default"], independent: ["default"] };
  const { code, diagnostics } = await compile(source, { filename: "home.tsx", target: "server", resume } as never);
  assert.deepEqual(diagnostics, []);
  assert.match(code, /clientEffect\(void 0, \{\s*when: "load"\s*\}\)/);
  assert.doesNotMatch(code, /setInterval/);
});

// Derived server modules keep `clientEvent` as `clientEvent(void 0, void 0, void 0, options)` (TOAST-ACTIVE): target,
// type and handler leave the SSR bundle, the call still flags the open boundary's client trigger — a standalone listener
// without `when` = idle. Lowered to `undefined`, a boundary whose only browser code is a document listener (cdk
// `ToastRegion`'s `rv-toast-queue`) never adopted on a resumed page.
test("derived server build keeps clientEvent's options, drops target / type / handler", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/dom";
export default function Home() {
  const n = signal(0);
  clientEvent(document, "rv-ping", () => n.set(n() + 1), { preload: "interaction" });
  clientEvent(window, "resize", () => n.set(0));
  clientEvent(window, "keydown", () => n.set(2), { preload: "interaction", standalone: false });
  return <p>{n()}</p>;
}`;
  const resume = { module: "src/home.tsx", boundaries: ["default"], independent: ["default"] };
  const { code, diagnostics } = await compile(source, { filename: "home.tsx", target: "server", resume } as never);
  assert.deepEqual(diagnostics, []);
  assert.match(code, /clientEvent\(void 0, void 0, void 0, \{\s*preload: "interaction"\s*\}\)/);
  assert.match(code, /clientEvent\(void 0, void 0, void 0\)/);
  // A literal `standalone: false` flags nothing: still `undefined` (no server bytes for the router's listeners).
  assert.doesNotMatch(code, /standalone/);
  assert.doesNotMatch(code, /document|window|rv-ping|resize|keydown/);
});

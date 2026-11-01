// FIX-CORE (2026-11-01): the inline loader cached a failed runtime import (`booting` stayed a rejected promise): once the
// reload fallback did not run (prevented `rivet:resume-error`, throwing sessionStorage, a reload in the last 10 s),
// every later event got the same rejection and the page never became interactive. A failed import is not cached.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export default function Card() {
  const clicks = signal(0);
  return <button type="button" class="card" onClick={() => clicks.update((v) => v + 1)}>{clicks()}</button>;
}`;
const RESUME = { module: "src/c.tsx", boundaries: ["Card"] };
const compiled = hasDerivedModel() ? test : test.skip;

compiled("a failed runtime import is retried by the next event", async () => {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  const { default: Card } = await importServer<{ default: () => ServerValue }>(server.code);
  const html = (await derivedToString(() => Card(), { manifest: { runtime: "/rt.js", symbols: { "src/c.tsx#default": "/c.js" } } })) as string;
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
  const offline = new Set(["/rt.js"]);
  const files = {
    ...DERIVED_BUILD,
    "/":
      "<!doctype html><html><body><script>document.addEventListener('rivet:resume-error', (e) => (window.__failed = (window.__failed || 0) + 1, e.preventDefault()))</script>" +
      html +
      "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(dom.code),
  };
  await withPage(
    files,
    async (p) => {
      await p.goto("http://rivet.test/");
      await p.click(".card");
      await p.waitForFunction(() => (window as unknown as { __failed?: number }).__failed! >= 1);
      offline.delete("/rt.js");
      await p.click(".card");
      // The runtime boots now; both held clicks replay in order.
      await p.waitForFunction(() => document.querySelector(".card")!.textContent === "2", undefined, { timeout: 3000 });
      await p.click(".card");
      await p.waitForFunction(() => document.querySelector(".card")!.textContent === "3");
    },
    { offline },
  );
});

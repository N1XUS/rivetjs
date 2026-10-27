// Derived model, adoption while a first mouse click's flush is held (COLD-FIX-A, 2026-10-27). Reactivity defers the
// DOM flush of the first trusted mouse click per document one task (`_dispatch` / `hold`); any `batched` call runs the
// held flush first. A unit's probe / adopt runs make `batched` calls (binding effects), so a unit adopting in that window
// (a wake whose chunk resolved, the next event of a tap's sequence in WebKit) ran another unit's held updates inside its
// own probe: a boundary that update created became a hole of the probing unit ("an adopt run diverged from its probe",
// WebKit touch on every Select-family trigger), a write ran inside a computed, a hole's owner was disposed under the
// probe. The adoption now runs the held flush before it starts (`dom-adopt-run.ts` `save`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

// A: its second click renders the child boundary C. B: an independent sibling with a binding (a `batched` call in its probe).
const PAGE = `
import { signal } from "@rivetjs/reactivity";

export function C() {
  const m = signal(0);
  return <i id="c" onClick={() => m.set(m() + 1)}>{m()}</i>;
}

export function A(props) {
  const n = signal(0);
  return (
    <div id="a-root">
      <button type="button" id="a" onClick={() => n.set(n() + 1)}>{n()}</button>
      {n() === 2 ? <C /> : null}
    </div>
  );
}

export function B(props) {
  const k = signal(0);
  return <button type="button" id="b" onClick={() => k.set(k() + 1)}>{k()}</button>;
}

export function Page() {
  return (
    <main>
      <A />
      <B />
    </main>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["A", "B", "C"], independent: ["A", "B"] };
const symbols = Object.fromEntries(RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
const manifest = { hash: "t", runtime: "/rt.js", symbols };

const compiled = hasDerivedModel() ? test : test.skip;

compiled("a unit adopting while a first click's flush is held runs that flush first, outside its probe", async () => {
  const out = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(out.code);
  const html = (await derivedToString(() => Page(), { manifest })) as string;
  const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  const b = tail.b.find((r) => r[3] === "src/page.tsx#B")!;
  assert.equal(b[2] & 1, 1, "B is independent (adopts standalone)");
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    // A adopts on a keyboard click (not held: only a trusted mouse click defers its flush).
    await page.press("#a", "Enter");
    await page.waitForFunction(() => document.querySelector("#a")!.textContent === "1");
    // B adopts from a window listener of the first mouse click: after A's handler, while A's flush is held.
    await page.evaluate(async (id) => {
      const rt = (await import("/rt.js" as string)).default as { m(id: number): Promise<void>; w(target: EventTarget): void };
      // B's chunk loaded (intent warm-up), so its adoption is synchronous.
      rt.w(document.querySelector("#b")!);
      await new Promise((done) => setTimeout(done, 100));
      window.addEventListener("click", () => void rt.m(id), { once: true });
    }, b[0]);
    await page.click("#a");
    await page.waitForFunction(() => document.querySelector("#a")!.textContent === "2");
    await page.waitForFunction(() => document.querySelector("#c")?.textContent === "0");
    assert.deepEqual(errors, []);
    // B adopted over its server node and is live; C (rendered by A's held update) is A's, live too.
    await page.click("#b");
    await page.waitForFunction(() => document.querySelector("#b")!.textContent === "1");
    await page.click("#c");
    await page.waitForFunction(() => document.querySelector("#c")!.textContent === "1");
    assert.deepEqual(errors, []);
  });
});

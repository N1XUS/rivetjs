import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const HANDLE = `<div id="handle" data-rv-capture="" style={{ width: "40px", height: "80px", touchAction: "none" }}
      onPointerDown={(event) => {
        origin.set(event.clientX);
        active.set(true);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      }}
      onPointerMove={(event) => { if (active()) delta.set(event.clientX - origin()); }}
      onPointerUp={() => { committed.set(delta()); active.set(false); }}
      onPointerCancel={() => active.set(false)}
    >Resize</div>`;

const source = (helper: boolean) => `import { signal } from "@rivetjs/reactivity";
${helper ? `function handle(active, delta, committed, origin) { return ${HANDLE}; }` : ""}
export function Resize() {
  const active = signal(false);
  const delta = signal(0);
  const committed = signal(-1);
  const origin = signal(0);
  return <main>
    ${helper ? "{handle(active, delta, committed, origin)}" : HANDLE}
    <div id="outside" style={{ width: "400px", height: "100px" }}>Outside</div>
    <output id="active">{String(active())}</output>
    <output id="committed">{committed()}</output>
  </main>;
}`;

const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/resize.tsx", boundaries: ["Resize"], independent: ["Resize"] };

async function files(helper = false) {
  const server = compile(source(helper), { target: "server", filename: "resize.tsx", resume } as never);
  const dom = compile(source(helper), { target: "dom", filename: "resize.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Resize } = await importServer<{ Resize: () => ServerValue }>(server.code);
  const html = await derivedToString(() => Resize(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/resize.tsx#Resize": "/resize.js" } },
    preload: { lean: true },
  });
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/resize.js": rewrite(dom.code),
  };
}

compiled("cold pointer capture: a helper's movement listener joins the page's captured event types", async () => {
  const served = await files(true);
  const events = /data-events="([^"]*)"/.exec(served["/"])?.[1]?.split(" ");
  assert.ok(events?.includes("pointermove"), "a helper's pointermove must be captured before its chunk loads");
});

for (const control of ["unmarked", "secondary"] as const)
  compiled(`cold pointer capture: ${control} presses retain ordinary native targeting`, async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    await withPage(
      await files(),
      async (page) => {
        await page.addInitScript(() => {
          (window as unknown as { captures: number }).captures = 0;
          document.addEventListener("gotpointercapture", () => (window as unknown as { captures: number }).captures++, true);
        });
        await page.goto("http://rivet.test/");
        if (control === "unmarked") await page.locator("#handle").evaluate((el) => el.removeAttribute("data-rv-capture"));
        const box = (await page.locator("#handle").boundingBox())!;
        const button = control === "secondary" ? "right" : "left";
        await page.mouse.move(box.x + 10, box.y + 20);
        await page.mouse.down({ button });
        await page.mouse.move(box.x + 90, box.y + 20);
        await page.mouse.up({ button });
        assert.equal(await page.evaluate(() => (window as unknown as { captures: number }).captures), 0);
        release();
      },
      { delays: { "/rt.js": pending } },
    );
  });

for (const helper of [false, true])
  for (const held of ["/rt.js", "/resize.js"])
    for (const input of ["mouse", "touch"] as const)
      compiled(`cold pointer capture: ${input} ${helper ? "helper" : "boundary"} move and release survive a delayed ${held}`, async () => {
        let release!: () => void;
        const pending = new Promise<void>((resolve) => (release = resolve));
        await withPage(
          await files(helper),
          async (page) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto("http://rivet.test/");
            const box = (await page.locator("#handle").boundingBox())!;
            const x = box.x + 10,
              y = box.y + 20;
            if (input === "mouse") {
              await page.mouse.move(x, y);
              await page.mouse.down();
              await page.mouse.move(x + 80, y, { steps: 3 });
              await page.mouse.up();
            } else {
              const cdp = await page.context().newCDPSession(page);
              await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
              await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 80, y }] });
              await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
              await cdp.detach();
            }
            assert.equal(await page.textContent("#committed"), "-1", "the component is still cold through physical release");
            release();
            await page.waitForFunction(() => document.querySelector("#committed")?.textContent === "80", undefined, { timeout: 5000 });
            assert.equal(await page.textContent("#active"), "false", "release ends the replayed gesture");
            assert.deepEqual(errors, []);
          },
          { delays: { [held]: pending } },
        );
      });

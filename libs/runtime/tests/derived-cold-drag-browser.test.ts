// Derived model, cold HTML5 drag and drop (COLD-DND): a native mouse drag that starts and ends before the boundary's
// chunk ran lands as on a loaded page. The page lists the drag types in `data-events` (a page with a drop target lists
// its drags' source events too: here a helper's `dragstart` / `dragend`), the loader holds the gesture, accepts its cold `dragenter` / `dragover` /
// `drop` (the browser fires no `drop` otherwise) and gives each held event a DataTransfer that outlives its dispatch: one
// per drag started on the page (the replayed `dragstart` writes it, later replays read it), else a copy of the event's
// own. Held `dragenter`s replay.
// Once the page runs, a drag is native. Pages without drag listeners keep the plain loader.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { DERIVED_LOADER } from "../resume-loader-derived.min.ts";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
function Source(props: { onStart: (e: DragEvent) => void; onEnd: (e: DragEvent) => void }) {
  return (
    <div id="src" draggable="true" style={{ width: "120px", height: "30px" }} onDragStart={(e) => props.onStart(e)} onDragEnd={(e) => props.onEnd(e)}>
      drag me
    </div>
  );
}
export function Board() {
  const dropped = signal("");
  const ended = signal("");
  const entered = signal(0);
  const ends = signal(0);
  return (
    <div>
      <Source
        onStart={(e) => {
          e.dataTransfer!.setData("text/plain", "payload");
          e.dataTransfer!.effectAllowed = "move";
        }}
        onEnd={(e) => {
          ended.set(e.dataTransfer!.dropEffect);
          ends.set(ends() + 1);
        }}
      />
      <div
        id="zone"
        style={{ width: "200px", height: "100px", marginTop: "40px" }}
        onDragEnter={(e) => {
          e.preventDefault();
          entered.set(entered() + 1);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          dropped.set(e.dataTransfer!.getData("text/plain") + ":" + e.dataTransfer!.effectAllowed + ":" + [...e.dataTransfer!.types].join(","));
        }}
      >
        zone
      </div>
      <output id="dropped">{dropped()}</output>
      <output id="ended">{ended()}</output>
      <output id="entered">{entered()}</output>
      <output id="ends">{ends()}</output>
    </div>
  );
}
`;
const PLAIN = `import { signal } from "@rivetjs/reactivity";
export function Plain() {
  const n = signal(0);
  return <button id="b" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/board.tsx", boundaries: ["Board"], independent: ["Board"] };

async function board(): Promise<{ html: string; chunk: string }> {
  const server = compile(SOURCE, { target: "server", filename: "board.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "board.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Board } = await importServer<{ Board: () => ServerValue }>(server.code);
  const symbols = { "src/board.tsx#Board": "/board.js" };
  const html = (await derivedToString(() => Board(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  return { html, chunk: rewrite(dom.code) };
}
const text = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.textContent, id);

compiled("cold drag: the page lists the drag types and ships the drag loader; a page without drag listeners keeps the plain one", async () => {
  const { html } = await board();
  const events = / data-events="([^"]*)"/.exec(html)?.[1]?.split(" ") ?? [];
  for (const type of ["dragstart", "drag", "dragend", "dragenter", "dragover", "drop"]) assert.ok(events.includes(type), type + " in data-events: " + events);
  assert.ok(!html.includes(DERIVED_LOADER), "drag pages ship the drag loader");
  const plain = compile(PLAIN, {
    target: "server",
    filename: "plain.tsx",
    resume: { module: "src/plain.tsx", boundaries: ["Plain"], independent: ["Plain"] },
  } as never);
  const { Plain } = await importServer<{ Plain: () => ServerValue }>(plain.code);
  const page = (await derivedToString(() => Plain(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/plain.tsx#Plain": "/plain.js" } },
    preload: { lean: true },
  } as never)) as string;
  assert.ok(page.includes("<script>" + DERIVED_LOADER + "</script>"), "the plain loader, byte for byte");
});

for (const engine of ["chromium", "webkit"] as const)
  (engine === "webkit" && !hasWebkit() ? test.skip : compiled)(
    `cold drag (${engine}): a native drag before the chunk ran drops as on a loaded page; a later drag is native`,
    async () => {
      const { html, chunk } = await board();
      let release!: () => void;
      const cold = new Promise<void>((resolve) => (release = resolve));
      await withPage(
        {
          ...DERIVED_BUILD,
          "/": "<!doctype html><html><body>" + html + "</body></html>",
          "/rt.js": 'export { default } from "/dom-derived.ts";',
          "/board.js": chunk,
        },
        async (page) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("http://rivet.test/");
          // Cold: the boundary's chunk is held back until after the drop.
          await page.dragAndDrop("#src", "#zone");
          assert.equal(await text(page, "dropped"), "", "nothing ran yet");
          release();
          await page.waitForFunction(() => document.getElementById("dropped")!.textContent !== "");
          assert.equal(await text(page, "dropped"), "payload:move:text/plain", "the replayed drop reads what the replayed dragstart wrote");
          await page.waitForFunction(() => document.getElementById("ended")!.textContent !== "");
          assert.equal(await text(page, "ended"), "move", "the replayed dragend sees the drop's effect");
          assert.ok(Number(await text(page, "entered")) >= 1, "held dragenters replay");
          assert.equal(await text(page, "ends"), "1");
          // Warm: the page runs, a second drag is native.
          await page.dragAndDrop("#src", "#zone");
          await page.waitForFunction(() => document.getElementById("ends")!.textContent === "2");
          // (A native drag's effects are the engine's: WebKit reports "all" for its drop's effectAllowed and its dragend's
          // dropEffect, whatever the handlers set.)
          assert.equal(await text(page, "dropped"), engine === "webkit" ? "payload:all:text/plain" : "payload:move:text/plain");
          assert.equal(await text(page, "ended"), engine === "webkit" ? "all" : "move");
          assert.deepEqual(errors, []);
        },
        { delays: { "/board.js": cold }, engine },
      );
    },
  );

compiled("cold drag: a drag from outside the page (no held dragstart) drops a copy of its own data", async () => {
  const { html, chunk } = await board();
  let release!: () => void;
  const cold = new Promise<void>((resolve) => (release = resolve));
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><html><body>" + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/board.js": chunk,
    },
    async (page) => {
      await page.goto("http://rivet.test/");
      const prevented = await page.evaluate(() => {
        const zone = document.getElementById("zone")!,
          dt = new DataTransfer();
        dt.setData("text/plain", "outside");
        const out: boolean[] = [];
        for (const type of ["dragenter", "dragover", "drop"]) {
          const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 10, clientY: 10 });
          zone.dispatchEvent(event);
          out.push(event.defaultPrevented);
        }
        dt.clearData();
        return out;
      });
      assert.deepEqual(prevented, [true, true, true], "cold dragenter / dragover / drop accepted");
      release();
      await page.waitForFunction(() => document.getElementById("dropped")!.textContent !== "");
      // (Its effectAllowed: what the page's own DataTransfer reports — a constructed one keeps "none".)
      assert.match((await text(page, "dropped"))!, /^outside:\w+:text\/plain$/, "a copy taken at dispatch (the source cleared its data since)");
    },
    { delays: { "/board.js": cold } },
  );
});

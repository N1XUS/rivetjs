// Derived model: capture-phase handlers (`onClickCapture`, `onKeyDownCapture`) resume like bubbling ones. A cold click /
// keydown adopts the boundary and its capture handler runs before the bubbling handler below it, so a capture handler that
// stops the event keeps the inner handler from running — cold (replayed by the loader) and warm (native listener).
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function App() {
  const log = signal("");
  const block = signal(false);
  return (
    <main>
      <div
        id="outer"
        onClickCapture={(e) => {
          log.set(log() + "C");
          if (block()) e.stopPropagation();
        }}
        onKeyDownCapture={() => log.set(log() + "K")}
      >
        <button id="inner" onClick={() => log.set(log() + "b")} onKeyDown={() => log.set(log() + "k")}>
          inner
        </button>
      </div>
      <Part id="part" onKeyDownCapture={() => log.set(log() + "P")} onKeyDown={() => log.set(log() + "p")} />
      <button id="block" onClick={() => block.set(true)}>{block() ? "on" : "off"}</button>
      <p id="log">{log()}</p>
    </main>
  );
}
// A part that spreads its props (cdk \`globalDOMProps\` style): the capture handler arrives through the spread.
export function Part(props) {
  return <button {...props}>part</button>;
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/page.tsx", boundaries: ["App", "Part"], independent: ["App"] };

async function served(): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js" } };
  const html = (await derivedToString(() => App(), { manifest })) as string;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}
const text = (page: Page): Promise<string> => page.evaluate(() => document.getElementById("log")!.textContent ?? "");

async function cold(run: (page: Page) => Promise<void>): Promise<void> {
  await withPage(await served(), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await run(page);
    assert.deepEqual(errors, []);
  });
}

compiled("capture handlers: a cold click runs onClickCapture before the inner onClick; warm clicks keep the order", async () => {
  await cold(async (page) => {
    await page.click("#inner");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "Cb", undefined, { timeout: 5000 });
    await page.click("#inner");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "CbCb", undefined, { timeout: 5000 });
  });
});

compiled("capture handlers: a capture handler that stops the event keeps the inner handler from running", async () => {
  await cold(async (page) => {
    await page.click("#block");
    await page.waitForFunction(() => document.getElementById("block")!.textContent === "on", undefined, { timeout: 5000 });
    await page.click("#inner");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "C", undefined, { timeout: 5000 });
    await page.click("#inner");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "CC", undefined, { timeout: 5000 });
    assert.equal(await text(page), "CC");
  });
});

compiled("capture handlers: a cold keydown runs onKeyDownCapture before the inner onKeyDown", async () => {
  await cold(async (page) => {
    await page.focus("#inner");
    await page.keyboard.press("a");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "Kk", undefined, { timeout: 5000 });
    await page.keyboard.press("a");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "KkKk", undefined, { timeout: 5000 });
  });
});

compiled("capture handlers: a capture handler passed through a spread runs on the first cold keydown", async () => {
  await cold(async (page) => {
    await page.focus("#part");
    await page.keyboard.press("a");
    await page.waitForFunction(() => document.getElementById("log")!.textContent === "Pp", undefined, { timeout: 5000 });
  });
});

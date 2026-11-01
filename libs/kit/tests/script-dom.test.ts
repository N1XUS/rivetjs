// Kit's browser script loader (happy-dom): a failed load can be retried, and a deferred head script arms its strategy once
// however often the head is applied before it fires.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

async function inWindow(run: (window: Window, added: string[]) => Promise<void>): Promise<void> {
  const window = new Window({ url: "https://x.test/", settings: { disableJavaScriptFileLoading: true } });
  const global = globalThis as unknown as Record<string, unknown>;
  const saved = { document: global.document, add: global.addEventListener, remove: global.removeEventListener };
  const added: string[] = [];
  global.document = window.document;
  type Listen = (type: string, fn: never, options: never) => void;
  global.addEventListener = (type: string, fn: never, options: never) => (added.push(type), (window.addEventListener as Listen)(type, fn, options));
  global.removeEventListener = (type: string, fn: never, options: never) => (window.removeEventListener as Listen)(type, fn, options);
  try {
    await run(window, added);
  } finally {
    global.document = saved.document;
    global.addEventListener = saved.add;
    global.removeEventListener = saved.remove;
    await window.happyDOM.close();
  }
}

test("loadScript: a failed load is not cached, a later call loads the script again", () =>
  inWindow(async (window) => {
    const { loadScript } = await import("../dom.ts");
    await assert.rejects(loadScript("/fails-once.js"), /Script failed to load: \/fails-once\.js/);
    assert.equal(window.document.querySelectorAll('script[src="/fails-once.js"]').length, 0, "the failed element is removed");
    window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
    await loadScript("/fails-once.js");
    assert.equal(window.document.querySelectorAll('script[src="/fails-once.js"]').length, 1);
  }));

test("an interaction head script arms its listeners once across head applies", () =>
  inWindow(async (window, added) => {
    window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
    const { applyRouteHead } = await import("../dom.ts");
    const head = { head: { scripts: [{ src: "/later.js", strategy: "interaction" as const }] } };
    applyRouteHead(head);
    await Promise.resolve();
    applyRouteHead({ head: { ...head.head, title: "B" } });
    await Promise.resolve();
    assert.deepEqual(
      added.filter((type) => type === "pointerdown"),
      ["pointerdown"],
    );
    window.dispatchEvent(new window.Event("pointerdown"));
    assert.equal(window.document.querySelectorAll('script[src="/later.js"]').length, 1);
  }));

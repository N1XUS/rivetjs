import assert from "node:assert/strict";
import { test } from "vitest";
import { Window } from "happy-dom";
import { createRoot, signal } from "@rivetjs/reactivity";
import { _on } from "../dom-events.ts";
import { _spread } from "../dom-v2-spread.ts";
import { on as liteOn, dispatch as liteDispatch } from "../dom-lite-core.ts";

async function inDocument(run: (document: Document, errors: unknown[]) => void): Promise<void> {
  const window = new Window();
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: window.document });
  const errors: unknown[] = [];
  window.addEventListener("error", (event) => {
    errors.push((event as unknown as { error: unknown }).error);
    event.preventDefault();
  });
  try {
    run(window.document as unknown as Document, errors);
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
    await window.happyDOM.close();
  }
}

test("Rivet delegation ignores another framework's $$click and dispatches its own ancestor once", () =>
  inDocument((document, errors) => {
    const parent = document.createElement("div"),
      button = document.createElement("button");
    parent.append(button);
    document.body.append(parent);
    let own = 0,
      foreign = 0;
    (button as unknown as { $$click: () => void }).$$click = () => foreign++;
    createRoot((dispose) => {
      _on(parent, "click", () => own++);
      try {
        button.click();
        assert.deepEqual(errors, []);
        assert.equal(own, 1);
        assert.equal(foreign, 0);
      } finally {
        dispose();
      }
    });
  }));

test("full delegation retains handlers created by the lite runtime after handoff", () =>
  inDocument((document, errors) => {
    const button = document.createElement("button");
    document.body.append(button);
    let hits = 0;
    liteOn(button, "click", () => hits++);
    // The full runtime takes over this document's listener, keeping the lite node bindings.
    document.removeEventListener("click", liteDispatch);
    _on(document.createElement("div"), "click", null);
    button.click();
    assert.deepEqual(errors, []);
    assert.equal(hits, 1);
  }));

test("spread composes with an explicit handler and restores it when the spread handler disappears", () =>
  inDocument((document, errors) => {
    const button = document.createElement("button");
    document.body.append(button);
    const log: string[] = [];
    createRoot((dispose) => {
      const props = signal<Record<string, unknown>>({ onClick: () => log.push("spread") });
      _on(button, "click", () => log.push("own"));
      _spread(button, props);
      try {
        button.click();
        assert.deepEqual(log, ["own", "spread"]);
        props.set({});
        button.click();
        assert.deepEqual(log, ["own", "spread", "own"]);
        assert.deepEqual(errors, []);
      } finally {
        dispose();
      }
    });
  }));

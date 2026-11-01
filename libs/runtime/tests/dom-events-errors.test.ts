import assert from "node:assert/strict";
import { test } from "vitest";
import { Window } from "happy-dom";
import { createRoot } from "@rivetjs/reactivity";
import { _on, _delegateBelow } from "../dom-events.ts";

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

// Native dispatch: a throwing listener is reported and the other listeners on the path still run.
test("a throwing delegated handler is reported, ancestors still run and currentTarget is restored", () =>
  inDocument((document, errors) => {
    const outer = document.createElement("section"),
      parent = document.createElement("div"),
      button = document.createElement("button");
    parent.append(button);
    outer.append(parent);
    document.body.append(outer);
    const log: string[] = [];
    const failure = Error("handler failed");
    createRoot((dispose) => {
      _on(outer, "click", (event) => log.push("outer:" + (event.currentTarget === outer)));
      _on(button, "click", () => {
        log.push("button");
        throw failure;
      });
      let seen: unknown = "unset";
      // Registered after the delegated dispatcher: sees the real currentTarget (the document).
      document.addEventListener("click", (event) => (seen = event.currentTarget));
      try {
        button.click();
        assert.deepEqual(log, ["button", "outer:true"]);
        assert.equal(seen, document);
        assert.deepEqual(errors, [failure]);
      } finally {
        dispose();
      }
    });
  }));

test("_delegateBelow runs every handler below the stop despite a throw, then rethrows the first error", () =>
  inDocument((document) => {
    const parent = document.createElement("div"),
      button = document.createElement("button");
    parent.append(button);
    document.body.append(parent);
    const log: string[] = [];
    const first = Error("first");
    createRoot((dispose) => {
      _on(button, "click", () => {
        log.push("button");
        throw first;
      });
      _on(parent, "click", () => log.push("parent"));
      const event = new (document.defaultView as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true });
      let caught: unknown;
      // Capture listener: the event's path is fixed, `_delegateBelow` runs the delegated handlers below the document early.
      document.addEventListener(
        "click",
        (e) => {
          try {
            _delegateBelow(e, document);
          } catch (error) {
            caught = error;
          }
          assert.equal((e as unknown as { currentTarget: unknown }).currentTarget, document);
        },
        { capture: true },
      );
      try {
        button.dispatchEvent(event);
        assert.equal(caught, first);
        assert.deepEqual(log, ["button", "parent"]);
      } finally {
        dispose();
      }
    });
  }));

// DOM runtime error texts (happy-dom; production and development resolution).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { mount } from "@rivetjs/runtime/dom";

const window = new Window({ url: "http://localhost/" });

test("a Promise child names the Async boundary it needs", () => {
  const host = window.document.createElement("div") as unknown as Element;
  assert.throws(() => mount(() => Promise.resolve("x") as never, host), (error: Error) => {
    assert.match(error.message, /Promise DOM children require an Async boundary/);
    assert.doesNotMatch(error.message, /Task/);
    return true;
  });
});

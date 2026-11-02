// Rivet test (FIX2-CDK, review r3-leaks#8): repeated cold carousel drag starts keep one pending first-move check.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { onFirstMove } = await import("../carousel/behaviour.tsx");

test("onFirstMove: a second arm replaces the first; the check runs once", () => {
  const calls: string[] = [];
  onFirstMove(document, () => calls.push("a"));
  onFirstMove(document, () => calls.push("b"));
  onFirstMove(document, () => calls.push("c"));
  document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  assert.deepEqual(calls, ["c"]);
});

// `useCSSVariable`: override wins, server (no document) is undefined, computed value of the variable on :root, cached by name.
import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const { useCSSVariable, _clearCSSVariableCache } = await import("../src/hooks/use-css-variable.ts");
beforeEach(() => _clearCSSVariableCache());

test("useCSSVariable: override wins; server (no document) is undefined", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(useCSSVariable("--x", "pulse"), "pulse");
  assert.equal(useCSSVariable("--x"), undefined);
});

test("useCSSVariable: reads the computed custom property on :root and caches by name", () => {
  installDom();
  document.documentElement.style.setProperty("--skeleton-animation", " shimmer ");
  assert.equal(useCSSVariable("--skeleton-animation"), "shimmer");
  document.documentElement.style.setProperty("--skeleton-animation", "pulse");
  assert.equal(useCSSVariable("--skeleton-animation"), "shimmer"); // cached
  assert.equal(useCSSVariable("--skeleton-animation", undefined, false), "pulse"); // cache off
  assert.equal(useCSSVariable("--skeleton-animation", "own"), "own"); // override beats the cache
});

test("useCSSVariable: an unset / empty variable is undefined (and that is cached)", () => {
  installDom();
  assert.equal(useCSSVariable("--nope"), undefined);
  document.documentElement.style.setProperty("--nope", "now");
  assert.equal(useCSSVariable("--nope"), undefined); // cached undefined
  assert.equal(useCSSVariable("--nope", undefined, false), "now");
});

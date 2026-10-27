// Public platform test hooks and lazy browser detection; each Vitest file has an isolated module graph.
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { _setSupports, supports, _resetPlatformMemo, getPlatform, isFirefox, isSafari, _isTestEnvironment } from "@rivetjs/cdk/platform";

installDom();
afterEach(() => {
  vi.unstubAllGlobals();
  _resetPlatformMemo();
  _setSupports("field-sizing", undefined);
});

test("feature overrides can be changed and cleared back to actual detection", () => {
  vi.stubGlobal("CSS", { supports: () => false });
  _setSupports("field-sizing", true);
  assert.equal(supports("field-sizing"), true);
  _setSupports("field-sizing", false);
  assert.equal(supports("field-sizing"), false);
  _setSupports("field-sizing", undefined);
  assert.equal(supports("field-sizing"), false);
});

test("platform reset refreshes Angular flags after the environment changes", () => {
  vi.stubGlobal("navigator", { userAgent: "Firefox/130.0", platform: "Linux" });
  _resetPlatformMemo();
  assert.equal(getPlatform().FIREFOX, true);
  vi.stubGlobal("navigator", { userAgent: "AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", platform: "MacIntel" });
  assert.equal(getPlatform().FIREFOX, true, "cached until reset");
  _resetPlatformMemo();
  assert.equal(getPlatform().FIREFOX, false);
  assert.equal(getPlatform().SAFARI, true);
});

test("Safari excludes Firefox even when the user agent advertises WebKit", () => {
  vi.stubGlobal("navigator", { userAgent: "AppleWebKit/605.1.15 FxiOS/130.0 Safari/605.1.15", platform: "iPhone" });
  assert.equal(isFirefox(), true);
  assert.equal(isSafari(), false);
  assert.equal(_isTestEnvironment(), true);
});

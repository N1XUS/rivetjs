// `utils/css-timing.ts` (MOTION-HARMONY): JS reads motion timing from computed CSS (Chromium).
import { afterEach, expect, test } from "vitest";
import { cssTimeMs, cssTiming, cssTransitionMs } from "../utils/css-timing.ts";

const el = (css: string): HTMLElement => {
  const div = document.createElement("div");
  div.style.cssText = css;
  document.body.append(div);
  return div;
};
afterEach(() => document.body.replaceChildren());

test("cssTimeMs: s / ms, junk = 0", () => {
  expect(cssTimeMs("0.26s")).toBe(260);
  expect(cssTimeMs("180ms")).toBe(180);
  expect(cssTimeMs("")).toBe(0);
  expect(cssTimeMs(undefined)).toBe(0);
});

test("cssTiming: the transition of the property (lists repeat), `all`, none", () => {
  const a = el("transition: translate 500ms linear, opacity 260ms cubic-bezier(0.32, 0.72, 0, 1)");
  expect(cssTiming(a, "opacity")).toEqual({ duration: 260, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
  expect(cssTiming(a, "translate")).toEqual({ duration: 500, easing: "linear" });
  expect(cssTiming(a, "color")).toBeNull();
  const b = el("transition-property: all; transition-duration: 0.2s; transition-timing-function: ease-in");
  expect(cssTiming(b, "opacity")).toEqual({ duration: 200, easing: "ease-in" });
  expect(cssTiming(el("transition: none"), "opacity")).toBeNull();
});

test("cssTiming: a CSS animation wins over transitions", () => {
  const style = document.createElement("style");
  style.textContent = "@keyframes ct-fade { from { opacity: 0 } }";
  document.head.append(style);
  const a = el("animation: ct-fade 300ms ease-out; transition: opacity 100ms linear");
  expect(cssTiming(a, "opacity")).toEqual({ duration: 300, easing: "ease-out" });
  style.remove();
});

test("cssTransitionMs: the longest duration + delay", () => {
  expect(cssTransitionMs(el("transition: width 180ms, inset-inline-start 100ms 120ms"))).toBe(220);
  expect(cssTransitionMs(el(""))).toBe(0);
});

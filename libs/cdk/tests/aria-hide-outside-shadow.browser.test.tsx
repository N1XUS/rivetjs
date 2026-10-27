// Ported from React Aria ariaHideOutside.test.js, Apache-2.0, Copyright 2020 Adobe.
// Shared upstream shadow cases on real Chromium; see aria-hide-outside-shadow-cases.ts.
import { afterEach, expect, test } from "vitest";
import { ariaHideOutside } from "../overlay/aria-hide-outside.ts";
import { shadowHideOutsideCases } from "./aria-hide-outside-shadow-cases.ts";
shadowHideOutsideCases();

// Rivet addition (PERF-REST P6: containment is one `nodeContains`-style climb per target): slot assignment needs a real
// browser (happy-dom assigns no slots), so this case is not in the shared suite.
const releases: (() => void)[] = [];
afterEach(() => {
  for (const release of releases.splice(0).reverse()) release();
  document.body.textContent = "";
});
test("Rivet: a slotted target is contained by its slot's parent, not by the slot", async () => {
  const host = document.createElement("div");
  host.innerHTML = '<button id="target">t</button><span id="light">l</span>';
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = '<div class="wrap"><slot></slot><i>sibling</i></div><aside>a</aside>';
  const target = host.querySelector("#target")!;
  const state = (...nodes: Element[]) => nodes.map((node) => node.getAttribute("aria-hidden"));
  releases.push(ariaHideOutside([target]));
  // The climb from a slotted node goes to its slot's parent: the slot itself contains no target and is hidden.
  expect(state(host, root.querySelector(".wrap")!, target)).toEqual([null, null, null]);
  expect(state(root.querySelector("slot")!, root.querySelector("i")!, root.querySelector("aside")!, host.querySelector("#light")!)).toEqual([
    "true",
    "true",
    "true",
    "true",
  ]);
  // A light child added later (the host contains the target: not inside a hidden node) is hidden.
  const light = document.createElement("em");
  host.append(light);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(state(light, host, target)).toEqual(["true", null, null]);
});

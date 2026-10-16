import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "overlayPosition",
  summary:
    "The React Aria position engine on your own elements: pick a placement, overlayPosition() places the panel, writes data-placement and returns the placement after flipping as a signal.",
  tags: ["cdk", "position", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/components/Placer.tsx"],
  test: [
    { click: "#op-top" },
    { attr: ["#op-panel", "data-placement", "top"] },
    { expect: ["#op-result", "top"] },
    { click: "#op-right" },
    { attr: ["#op-panel", "data-placement", "right"] },
    { expect: ["#op-result", "right"] },
    { click: "#op-bottom" },
    { attr: ["#op-panel", "data-placement", "bottom"] },
    { matches: "#op-panel[style*='position: absolute']" },
    { click: "#op-left" },
    { attr: ["#op-panel", "data-placement", "left"] },
    { expect: ["#op-result", "left"] },
  ],
});

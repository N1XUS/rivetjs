import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover with an arrow",
  summary: "An OverlayArrow inside the Popover: the engine positions it along the edge facing the trigger; data-placement rotates the tip to the side used.",
  tags: ["popover", "arrow", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#arrow-down-trigger" },
    { matches: "[data-rv-overlay]:has(#arrow-down) .arrow" },
    { attr: ["[data-rv-overlay]:has(#arrow-down) .arrow", "data-placement", "bottom"] },
    { name: ["#arrow-down", "Arrow"] },
    { key: "Escape" },
    { absent: "#arrow-down" },
    { click: "#arrow-right-trigger" },
    { attr: ["[data-rv-overlay]:has(#arrow-right) .arrow", "data-placement", "right"] },
    { key: "Escape" },
    { absent: "#arrow-right" },
  ],
});

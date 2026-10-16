import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover placement",
  summary:
    "Popover placement (top, bottom, left, right, start, end, with a cross side), offset and crossOffset, flipping when there is no room and shouldFlip={false}; data-placement shows the side used.",
  tags: ["popover", "placement", "position"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#pl-top-trigger" },
    { attr: [".rv-Popover:has(#pl-top)", "data-placement", "top"] },
    { key: "Escape" },
    { click: "#pl-bottom-trigger" },
    { attr: [".rv-Popover:has(#pl-bottom)", "data-placement", "bottom"] },
    { key: "Escape" },
    { click: "#pl-left-trigger" },
    { attr: [".rv-Popover:has(#pl-left)", "data-placement", "left"] },
    { key: "Escape" },
    { click: "#pl-right-trigger" },
    { attr: [".rv-Popover:has(#pl-right)", "data-placement", "right"] },
    { key: "Escape" },
    // start / end are logical: left / right in a left-to-right page.
    { click: "#pl-start-trigger" },
    { attr: [".rv-Popover:has(#pl-start)", "data-placement", "left"] },
    { key: "Escape" },
    { click: "#pl-end-trigger" },
    { attr: [".rv-Popover:has(#pl-end)", "data-placement", "right"] },
    { key: "Escape" },
    // No room above the first row: placement="top" flips to the bottom…
    { click: "#pl-flip-trigger" },
    { attr: [".rv-Popover:has(#pl-flip)", "data-placement", "bottom"] },
    { key: "Escape" },
    // …unless shouldFlip is false.
    { click: "#pl-noflip-trigger" },
    { attr: [".rv-Popover:has(#pl-noflip)", "data-placement", "top"] },
    { key: "Escape" },
    { absent: "#pl-noflip" },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu placement",
  summary: "The Popover placement prop puts the menu above, below or beside its trigger; data-placement on the popover names the side it ended up on.",
  tags: ["menu", "placement"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#p-top-trigger" },
    { attr: [".p-top-popover", "data-placement", "top"] },
    { key: "Escape" },
    { absent: ".p-top-popover" },
    { click: "#p-bottom-trigger" },
    { attr: [".p-bottom-popover", "data-placement", "bottom"] },
    { key: "Escape" },
    { click: "#p-start-trigger" },
    { attr: [".p-start-popover", "data-placement", "left"] },
    { key: "Escape" },
    { click: "#p-end-trigger" },
    { attr: [".p-end-popover", "data-placement", "right"] },
    { key: "Escape" },
    { absent: ".p-end-popover" },
  ],
});

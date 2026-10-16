import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Custom overlay",
  summary:
    "A filter panel on overlay() from @rivetjs/cdk/overlay and overlayPosition() from @rivetjs/cdk/position: placed under its trigger, Escape and outside press close it, focus moves in and back.",
  tags: ["cdk", "overlay", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/FilterButton.tsx"],
  test: [
    { attr: ["#filters-trigger", "aria-expanded", "false"] },
    { matches: "#filters[hidden]" },
    { click: "#filters-trigger" },
    { matches: "#filters:not([hidden])" },
    { attr: ["#filters-trigger", "aria-expanded", "true"] },
    { focused: "#in-stock" },
    { key: "Escape" },
    { matches: "#filters[hidden]" },
    { attr: ["#filters-trigger", "aria-expanded", "false"] },
    { focused: "#filters-trigger" },
    { key: "Enter" },
    { matches: "#filters:not([hidden])" },
    { focused: "#in-stock" },
    { key: "Space" },
    { matches: "#in-stock:checked" },
    { click: "#heading" },
    { matches: "#filters[hidden]" },
    { attr: ["#filters-trigger", "aria-expanded", "false"] },
  ],
});

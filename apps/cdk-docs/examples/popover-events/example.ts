import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover events",
  summary: "DialogTrigger onOpenChange plus global DOM events and attributes on each part: the trigger Button, the Popover element and the OverlayArrow.",
  tags: ["popover", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#pe-trigger", "dir", "ltr"] },
    { click: "#pe-trigger" },
    { matches: "#pe" },
    // The component's press handling runs first (it opens), then your click handler.
    { expect: ["#pe-log", "open trigger:click"] },
    { attr: [".rv-Popover:has(#pe)", "lang", "es"] },
    { attr: [".rv-Popover:has(#pe) .rv-OverlayArrow", "lang", "pt"] },
    { rightclick: ".rv-Popover:has(#pe) .rv-OverlayArrow" },
    { expect: ["#pe-log", "arrow:contextmenu"] },
    { click: "#pe-body" },
    { expect: ["#pe-log", "popover:enter"] },
    { expect: ["#pe-log", "popover:click"] },
    { key: "Escape" },
    { absent: "#pe" },
    { expect: ["#pe-log", "close"] },
  ],
});

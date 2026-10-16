import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dialog events",
  summary:
    "onOpenChange plus global DOM events and attributes on each part: the trigger Button, the Modal element and the ModalOverlay underlay each take their own props.",
  tags: ["dialog", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // Attributes land on their part; the trigger renders on the server.
    { attr: ["#ev-dialog-trigger", "lang", "en"] },
    { press: ["#ev-dialog-trigger", "Enter"] },
    { matches: "#ev-dialog" },
    // The trigger opens (onOpenChange logs) and the Button's own onClick runs too.
    { expect: ["#ev-log", "open"] },
    { expect: ["#ev-log", "trigger:click"] },
    { attr: [".rv-Modal:has(#ev-dialog)", "lang", "fr"] },
    { matches: ".rv-ModalOverlay[dir=ltr]" },
    { click: "#ev-dialog-body" },
    { expect: ["#ev-log", "modal:enter"] },
    { expect: ["#ev-log", "modal:click"] },
    { key: "Escape" },
    { absent: "#ev-dialog" },
    { expect: ["#ev-log", "close"] },
  ],
});

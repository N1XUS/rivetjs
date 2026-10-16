import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover",
  summary:
    "DialogTrigger > Button + Popover > Dialog: a dialog anchored to its trigger in the overlay layer; focus moves in, Escape and outside clicks close it, focus returns.",
  tags: ["popover", "overlay", "dialog"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { name: ["#settings-trigger", "Settings"] },
    // useOverlayTrigger({type: "dialog"}): no aria-haspopup; aria-controls only while open.
    { attr: ["#settings-trigger", "aria-haspopup", null] },
    { attr: ["#settings-trigger", "aria-expanded", "false"] },
    { attr: ["#settings-trigger", "aria-controls", null] },
    // Closed: not rendered.
    { absent: "#settings-dialog" },
    { click: "#settings-trigger" },
    // A Dialog inside: the popover element itself has no role (RAC role detection).
    { attr: [".rv-Popover", "role", null] },
    { attr: ["#settings-dialog", "role", "dialog"] },
    { attr: [".rv-Popover", "data-trigger", "DialogTrigger"] },
    { attr: [".rv-Popover", "data-placement", "bottom"] },
    { attr: ["#settings-trigger", "aria-expanded", "true"] },
    { attr: ["#settings-trigger", "aria-controls", "settings-dialog"] },
    // The dialog takes focus; Tab moves to its first switch and stays inside (modal).
    { focused: "#settings-dialog" },
    { key: "Tab" },
    { focused: "#wifi" },
    { key: "Escape" },
    { absent: "#settings-dialog" },
    { focused: "#settings-trigger" },
    { click: "#settings-trigger" },
    { matches: "#settings-dialog" },
    // Second open renders the content again.
    { expect: ["#settings-dialog", "Bluetooth"] },
    { click: "body" },
    { absent: "#settings-dialog" },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled dialogs",
  summary:
    "isOpen as a two-way signal: a DialogTrigger opened from elsewhere, a standalone Modal (no trigger, isOpen signal) opened by a Button, onOpenChange logs the changes the overlay makes.",
  tags: ["dialog", "modal", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#ctl-state", "trigger=closed modal=closed"] },
    // A DialogTrigger whose isOpen signal another button sets.
    { click: "#ctl-open-elsewhere" },
    { matches: "#ctl-dialog" },
    { attr: ["#ctl-dialog-trigger", "aria-expanded", "true"] },
    { expect: ["#ctl-state", "trigger=open"] },
    { key: "Escape" },
    { absent: "#ctl-dialog" },
    { expect: ["#ctl-state", "trigger=closed"] },
    // onOpenChange reports changes the dialog makes (trigger, Escape, close), not your own `set`.
    { expect: ["#ctl-log", "close"] },
    { click: "#ctl-dialog-trigger" },
    { matches: "#ctl-dialog" },
    // Second open renders the content again (not only the heading).
    { expect: ["#ctl-dialog p", "Opened by the trigger or from outside."] },
    { key: "Escape" },
    { absent: "#ctl-dialog" },
    { expect: ["#ctl-log", "close open close"] },
    // A standalone Modal: no trigger element; aria-label names it.
    { click: "#ctl-open-modal" },
    { matches: "#ctl-modal[aria-label=Notice]" },
    { expect: ["#ctl-state", "modal=open"] },
    { click: "#ctl-modal-close" },
    { absent: "#ctl-modal" },
    { expect: ["#ctl-state", "modal=closed"] },
    { expect: ["#ctl-log", "close open close modal:close"] },
  ],
});

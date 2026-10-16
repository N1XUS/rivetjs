import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select DOM events",
  summary: "Global DOM events and attributes on the root, the trigger, the value, the popover, the listbox and the options (item objects).",
  tags: ["select", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#de", "lang", "en"] },
    { attr: ["#de-trigger", "dir", "ltr"] },
    { attr: ["#de-value", "lang", "en-GB"] },
    // A mouse press: the root and trigger handlers run; the select still opens on pointerdown.
    { click: "#de-trigger" },
    { matches: "#de-listbox" },
    { expect: ["#log", "root-enter"] },
    { expect: ["#log", "trigger-down"] },
    { attr: ["#de-popover", "lang", "fi"] },
    { attr: ["#de-listbox", "dir", "ltr"] },
    { attr: ["#de-listbox-option-cat", "lang", "en"] },
    // Option and listbox handlers run, and the option still selects.
    { click: "#de-listbox-option-dog" },
    { expect: ["#log", "dog-enter"] },
    { expect: ["#log", "list-down"] },
    { expect: ["#log", "list-up"] },
    { absent: "#de-listbox" },
    { expect: ["#de-value", "Dog"] },
  ],
});

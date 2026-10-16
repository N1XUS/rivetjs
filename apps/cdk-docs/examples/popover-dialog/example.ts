import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dialog in a popover",
  summary:
    "DialogTrigger > Button + Popover > Dialog: the popover element has no role, the Dialog inside is the dialog (labelled by its title); its close render prop closes the popover.",
  tags: ["popover", "dialog", "composition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#share-trigger" },
    // The popover element has no role; the section inside is the dialog.
    { attr: [".rv-Popover:has(#share-dialog)", "role", null] },
    { attr: ["#share-dialog", "role", "dialog"] },
    { name: ["#share-dialog", "Share"] },
    { attr: ["#share-trigger", "aria-controls", "share-dialog"] },
    { focused: "#share-dialog" },
    { click: "#share-copy" },
    { absent: "#share-dialog" },
    { expect: ["#share-status", "Link copied"] },
    { focused: "#share-trigger" },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone with a file picker",
  summary:
    "A DropZone that takes dropped files or a paste (its hidden button is the focus target), with a FileTrigger button as the keyboard alternative; data-drop-target and data-focus-visible style the zone.",
  tags: ["drop-zone", "file-trigger"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#dz-status", "Nothing received yet"] },
    { attr: ["#dz button:not(#dz-pick)", "aria-label", "Attachments"] },
    { name: ["#dz button:not(#dz-pick)", "Drop files here"] },
    { press: ["#dz button:not(#dz-pick)", "Tab"] },
    { focused: "#dz-pick" },
  ],
});

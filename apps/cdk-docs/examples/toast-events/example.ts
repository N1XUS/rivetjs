import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast events and DOM attributes",
  summary:
    "onClose per toast, global DOM events and attributes on ToastRegion (its div), Toast and ToastContent; the region's own hover / focus handlers run first.",
  tags: ["toast", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#te-add" },
    { attr: ["[role=region]", "lang", "en-GB"] },
    { attr: ["[role=region]", "data-area", "notifications"] },
    { attr: ["[role=alertdialog]", "lang", "nl"] },
    { attr: ["[role=alert]", "data-part", "content"] },
    { hover: "[role=alertdialog]" },
    { expect: ["#te-log", "region:enter"] },
    { dblclick: "[role=alert]" },
    { expect: ["#te-log", "toast:dblclick"] },
    { click: "[role=alertdialog] .close" },
    { expect: ["#te-log", "onClose"] },
    { absent: "[role=region]" },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Compact File List",
  summary: "A small area with an inline label and a dense file list: icon, name and size on one line.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#dz-compact [data-slot=drop-zone-file-item]:first-child [data-slot=drop-zone-file-remove-trigger]",
    },
    {
      absent: "#dz-compact [data-slot=drop-zone-file-item]:nth-child(2)",
    },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: With File List",
  summary: "Each file becomes a row with its format, size and upload progress; failed uploads can be retried, any row removed.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#dz-list [data-slot=drop-zone-file-item][data-status=failed]",
    },
    {
      click: "#dz-list [data-status=failed] [data-slot=drop-zone-file-retry-trigger]",
    },
    {
      absent: "#dz-list [data-status=failed]",
    },
    {
      click: "#dz-list [data-slot=drop-zone-file-item]:first-child [data-slot=drop-zone-file-remove-trigger]",
    },
    {
      absent: "#dz-list [data-slot=drop-zone-file-item]:nth-child(3)",
    },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Max Size Limit",
  summary: "Check sizes in onDrop / onSelect: files over 1 MB become failed rows with a reason.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#dz-max [data-status=failed] [data-slot=drop-zone-file-meta]", "over the 1 MB limit"],
    },
    {
      click: "#dz-max [data-slot=drop-zone-file-remove-trigger]",
    },
    {
      absent: "#dz-max [data-slot=drop-zone-file-item]",
    },
  ],
});

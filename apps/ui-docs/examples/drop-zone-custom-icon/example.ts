import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Custom Icon",
  summary: "Give DropZone.Icon any lucide icon (or other content) instead of the default upload cloud.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#dz-icon [data-slot=drop-zone-icon] svg",
    },
  ],
});

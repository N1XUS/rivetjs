import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Usage",
  summary: "Drop files on the area or press the button to browse; the picked file names show below.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#dz-basic-names", "No files yet"],
    },
    {
      name: ["#dz-basic [data-slot=drop-zone-area] button[aria-labelledby]", "Drag files here or click to browse"],
    },
    {
      key: "Tab",
    },
    {
      attr: ["#dz-basic [data-slot=drop-zone-area]", "data-focus-visible", "true"],
    },
  ],
});

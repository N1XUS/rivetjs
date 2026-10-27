import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Multiple Files",
  summary: "multiple on the input lets the picker select several files; drops always carry every dragged item.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#dz-multiple-count", "Files received: 0"],
    },
    {
      matches: "#dz-multiple input[type=file][multiple]",
    },
  ],
});

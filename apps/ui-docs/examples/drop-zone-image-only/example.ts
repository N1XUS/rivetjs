import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Image Only",
  summary: "getDropOperation refuses anything but images while dragging; the file input accepts only images.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#dz-image-status", "Drop an image"],
    },
    {
      matches: "#dz-image input[type=file][accept='image/*']",
    },
  ],
});

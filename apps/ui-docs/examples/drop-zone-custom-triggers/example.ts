import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DropZone: Custom Triggers",
  summary: "DropZone.Trigger takes Button props: change its text, variant and size, or put several next to each other.",
  tags: ["drop-zone"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#dz-triggers [data-slot=drop-zone-trigger]", "Upload resume"],
    },
    {
      expect: ["#dz-triggers-picked", "Nothing picked"],
    },
  ],
});

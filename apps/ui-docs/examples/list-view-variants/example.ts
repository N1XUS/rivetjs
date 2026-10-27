import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Variants",
  summary: "primary (default) is a grey card of surface rows; secondary is a flat list with separators.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["[aria-label=Secondary]", "data-variant", "secondary"],
    },
  ],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Sizes",
  summary: "size sets row height, text size and indent: sm, md (default) or lg.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["[aria-label='Project lg']", "data-size", "lg"],
    },
  ],
});

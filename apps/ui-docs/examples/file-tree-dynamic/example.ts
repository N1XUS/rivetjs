import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Dynamic Collection",
  summary: "Pass items and a render function; a row renders its children through a nested Collection.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ft-dynamic [role=row][data-key=about]",
    },
    {
      absent: "#ft-dynamic [role=row][data-key=logo]",
    },
  ],
});

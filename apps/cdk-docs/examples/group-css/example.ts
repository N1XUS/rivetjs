import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group with plain CSS",
  summary: "A plain stylesheet for .rv-Group and its data-focus-within, data-focus-visible, data-hovered, data-invalid and data-disabled attributes.",
  tags: ["group", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [{ matches: "#css-group.rv-Group" }, { press: ["#css-before", "Tab"] }, { attr: ["#css-group", "data-focus-visible", "true"] }],
});

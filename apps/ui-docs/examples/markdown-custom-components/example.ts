import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Markdown: Custom components",
  summary: "The `components` map replaces the element rendered per node type: links with an icon, inline code as a Kbd, headings with an anchor.",
  tags: ["markdown"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "a[data-custom=link]" }, { matches: "kbd[data-custom=code]" }, { matches: "h3[data-custom=heading]" }],
});

import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Press Mode",
  summary: 'triggerMode="press" opens on press (touch friendly); pressing an item closes the list.',
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#toc-press",
    },
    {
      click: "#toc-press-usage",
    },
    {
      absent: "#toc-press-usage",
    },
  ],
});

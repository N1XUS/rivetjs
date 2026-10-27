import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Controlled",
  summary: "open takes a value or a two-way signal; onOpenChange reports changes.",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#toc-open",
    },
    {
      matches: "#toc-ctrl-faq",
    },
  ],
});

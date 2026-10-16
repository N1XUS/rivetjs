import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator orientation",
  summary: "Separator renders an hr when horizontal and a div role=separator with aria-orientation=vertical when vertical; styled by data-free plain CSS.",
  tags: ["separator", "orientation", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "hr#sep-h.rv-Separator" }, { attr: ["#sep-v", "role", "separator"] }, { attr: ["#sep-v", "aria-orientation", "vertical"] }],
});

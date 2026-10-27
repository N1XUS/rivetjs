import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Status: Sizes",
  summary: "Small, medium (default) and large dots.",
  tags: ["status"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#status-sizes .status--sm" }, { matches: "#status-sizes .status--md" }, { matches: "#status-sizes .status--lg" }],
});

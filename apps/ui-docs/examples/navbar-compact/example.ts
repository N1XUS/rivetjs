import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Compact",
  summary: 'size="sm": a shorter bar with smaller items.',
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".navbar__header--sm" }],
});

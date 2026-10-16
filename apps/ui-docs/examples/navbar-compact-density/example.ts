import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Compact Density",
  summary: "A dense tool bar: small size, 2.75rem height, full width.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[aria-label=Editor]" }],
});
